import { NextResponse } from "next/server";

import { sendPaidEmailIfNeeded } from "@/lib/orderNotifications";
import { markOrderPaid } from "@/lib/orderPayments";
import { getMercadoPagoPayment } from "@/lib/mercadoPago";
import { sendNewOrderAdminEmailByOrderId } from "@/lib/adminOrderNotifications";
import { syncApprovedOrderToTiny } from "@/lib/tinyOrders";

export const runtime = "nodejs";

function getPaymentId(req: Request, body: unknown) {
  const url = new URL(req.url);
  const searchId = url.searchParams.get("data.id");
  if (searchId) return searchId;

  if (body && typeof body === "object") {
    const data = body as {
      data?: { id?: string | number };
      type?: string;
      action?: string;
    };
    if (data?.data?.id) return data.data.id;
  }

  return "";
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET || "";
  const requestToken = url.searchParams.get("token") || "";

  if (webhookSecret && requestToken !== webhookSecret) {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const paymentId = getPaymentId(req, body);

  if (!paymentId) {
    return NextResponse.json({ ok: true, ignored: true, reason: "missing_payment_id" });
  }

  try {
    const payment = await getMercadoPagoPayment(paymentId);
    const orderId = String(
      payment.external_reference ||
        payment.metadata?.orderId ||
        "",
    ).trim();

    if (!orderId) {
      return NextResponse.json({ ok: true, ignored: true, reason: "missing_order_reference" });
    }

    if (payment.status !== "approved") {
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason: "payment_not_approved",
        status: payment.status,
      });
    }

    const result = await markOrderPaid({
      orderId,
      paidBy: "mercadopago",
      paymentPatch: {
        mercadoPagoPaymentId: payment.id,
        mercadoPagoPaymentMethodId: payment.payment_method_id ?? null,
        installments: payment.installments ?? null,
        paymentStatus: payment.status ?? null,
      },
    });

    const syncResult = await syncApprovedOrderToTiny(orderId).catch((error) => {
      console.error("Erro ao sincronizar pedido aprovado no Tiny (Mercado Pago):", error);
      return null;
    });

    if (syncResult && !syncResult.ok) {
      console.error("Falha de sincronizacao Tiny (Mercado Pago):", syncResult.message);
    }

    if (!result.alreadyProcessed && result.shouldSendPaidEmail) {
      try {
        await sendNewOrderAdminEmailByOrderId(result.orderId);
      } catch (error) {
        console.error("Erro ao enviar email admin Mercado Pago:", error);
      }

      try {
        await sendPaidEmailIfNeeded(result.orderId);
      } catch (error) {
        console.error("Erro ao enviar email de pagamento Mercado Pago:", error);
      }
    }

    return NextResponse.json({ ok: true, order_id: orderId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json(
      { ok: false, error: "mercadopago_webhook_error", message },
      { status: 500 },
    );
  }
}
