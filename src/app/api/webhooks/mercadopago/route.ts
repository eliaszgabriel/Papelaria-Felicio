import crypto from "crypto";
import { NextResponse } from "next/server";

import { sendPaidEmailIfNeeded } from "@/lib/orderNotifications";
import { markOrderPaid } from "@/lib/orderPayments";
import { getMercadoPagoPayment } from "@/lib/mercadoPago";
import { sendNewOrderAdminEmailByOrderId } from "@/lib/adminOrderNotifications";
import { syncApprovedOrderToTiny } from "@/lib/tinyOrders";
import { requireConfiguredSecret } from "@/lib/runtimeSecrets";
import { secureCompareText } from "@/lib/secureCompare";

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

function verifyMercadoPagoSignature(
  webhookSecret: string,
  xSignature: string | null,
  xRequestId: string | null,
  paymentId: string,
) {
  if (!xSignature || !xRequestId || !paymentId) {
    return false;
  }

  const parts = xSignature.split(",").reduce<Record<string, string>>((acc, item) => {
    const [rawKey, rawValue] = item.split("=");
    const key = String(rawKey || "").trim();
    const value = String(rawValue || "").trim();
    if (key && value) {
      acc[key] = value;
    }
    return acc;
  }, {});

  const ts = parts.ts;
  const hash = parts.v1;
  if (!ts || !hash) {
    return false;
  }

  const manifest = `id:${paymentId};request-id:${xRequestId};ts:${ts};`;
  const expectedHash = crypto
    .createHmac("sha256", webhookSecret)
    .update(manifest)
    .digest("hex");

  return secureCompareText(expectedHash, hash);
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const webhookSecret = requireConfiguredSecret("MERCADOPAGO_WEBHOOK_SECRET");
  const headerSecret = req.headers.get("x-mercadopago-webhook-secret") || "";
  const queryToken = url.searchParams.get("token") || "";

  const body = await req.json().catch(() => null);
  const paymentId = String(getPaymentId(req, body) || "");

  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");
  const hasMercadoPagoSignature = Boolean(xSignature && xRequestId && paymentId);
  const validSignature = hasMercadoPagoSignature
    ? verifyMercadoPagoSignature(webhookSecret, xSignature, xRequestId, paymentId)
    : false;
  const validHeaderSecret = secureCompareText(headerSecret, webhookSecret);
  const validQueryToken = secureCompareText(queryToken, webhookSecret);

  if (!validSignature && !validHeaderSecret && !validQueryToken) {
    console.warn("Mercado Pago webhook rejeitado:", {
      hasMercadoPagoSignature,
      hasHeaderSecret: Boolean(headerSecret),
      hasQueryToken: Boolean(queryToken),
      paymentId: paymentId || null,
    });
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
  }

  if (!paymentId) {
    console.warn("Mercado Pago webhook ignorado por falta de paymentId");
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
      console.warn("Mercado Pago webhook sem referencia de pedido:", {
        paymentId,
      });
      return NextResponse.json({ ok: true, ignored: true, reason: "missing_order_reference" });
    }

    if (payment.status !== "approved") {
      console.log("Mercado Pago webhook recebido com status nao aprovado:", {
        orderId,
        paymentId,
        status: payment.status,
      });
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
        mercadoPagoPaymentId: String(payment.id),
        mercadoPagoPaymentMethodId: payment.payment_method_id ?? null,
        installments: payment.installments ?? null,
        paymentStatus: payment.status ?? null,
      },
    });

    const syncResult = await syncApprovedOrderToTiny(orderId).catch((error) => {
      console.error("Erro ao sincronizar pedido aprovado no Tiny (Mercado Pago):", error);
      return null;
    });

    if (syncResult?.ok && syncResult.skipped) {
      console.log("Sincronizacao Tiny pulada (Mercado Pago):", syncResult.reason);
    }

    if (syncResult?.ok && !syncResult.skipped) {
      console.log("Pedido sincronizado com Tiny (Mercado Pago):", {
        orderId,
        tinyOrderId: syncResult.tinyOrderId,
        tinyOrderNumber: syncResult.tinyOrderNumber ?? null,
      });
    }

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

    console.log("Mercado Pago webhook processado com sucesso:", {
      orderId,
      paymentId,
      usedSignature: validSignature,
      usedHeaderSecret: validHeaderSecret,
      usedQueryToken: validQueryToken,
    });

    return NextResponse.json({ ok: true, order_id: orderId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unknown_error";
    console.error("Erro no webhook Mercado Pago:", {
      paymentId: paymentId || null,
      message,
    });
    return NextResponse.json(
      { ok: false, error: "mercadopago_webhook_error", message },
      { status: 500 },
    );
  }
}
