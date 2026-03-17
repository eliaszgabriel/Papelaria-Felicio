import { NextRequest, NextResponse } from "next/server";
import { sendPaidEmailIfNeeded } from "@/lib/orderNotifications";
import { markOrderPaid } from "@/lib/orderPayments";
import { pushinpayGetTransaction } from "@/lib/pushinpay";
import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";

export const runtime = "nodejs";

type PushinWebhookBody = {
  id: string;
  status?: string;
};

type ProcessPaymentResult =
  | { alreadyProcessed: true; shouldSendPaidEmail: false }
  | {
      alreadyProcessed: false;
      orderId: string;
      shouldSendPaidEmail: boolean;
    };

export async function POST(req: NextRequest) {
  const expectedToken = process.env.PUSHINPAY_WEBHOOK_SECRET || "";
  const receivedToken = req.nextUrl.searchParams.get("token") || "";

  if (expectedToken && receivedToken !== expectedToken) {
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => null)) as PushinWebhookBody | null;
  if (!body?.id) {
    return NextResponse.json(
      { ok: false, error: "bad_request" },
      { status: 400 },
    );
  }

  let transaction;
  try {
    transaction = await pushinpayGetTransaction(body.id);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unknown_error";
    console.error("Erro ao consultar transacao PushinPay:", message);
    return NextResponse.json(
      { ok: false, error: "pushinpay_api_error" },
      { status: 500 },
    );
  }

  if (!transaction || transaction.status !== "paid") {
    return NextResponse.json({
      ok: true,
      ignored: true,
      status: transaction?.status,
    });
  }

  let fallbackRow: Record<string, unknown> | undefined;

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const result = await pool.query<Record<string, unknown>>(
      `SELECT id, status, total, "statusHistoryJson", "paymentJson", "createdAt", "itemsJson",
              "stockDeductedAt", "paidNotifiedAt"
       FROM orders
       WHERE "paymentJson" LIKE $1
       LIMIT 1`,
      [`%${body.id}%`],
    );
    fallbackRow = result.rows[0];
  } else {
    const { db } = await import("@/lib/db");
    const row = db
      .prepare(
        `SELECT id, status, total, statusHistoryJson, paymentJson, createdAt, itemsJson,
                stockDeductedAt, paidNotifiedAt
         FROM orders
         WHERE json_extract(paymentJson, '$.pushinpayTransactionId') = ?
         LIMIT 1`,
      )
      .get(body.id) as Record<string, unknown> | undefined;

    fallbackRow =
      row ||
      (db
        .prepare(
          `SELECT id, status, total, statusHistoryJson, paymentJson, createdAt, itemsJson,
                  stockDeductedAt, paidNotifiedAt
           FROM orders
           WHERE paymentJson LIKE ? LIMIT 1`,
        )
        .get(`%${body.id}%`) as Record<string, unknown> | undefined);
  }

  if (!fallbackRow) {
    return NextResponse.json(
      { ok: false, error: "order_not_found" },
      { status: 404 },
    );
  }

  const orderCents = Math.round(Number(fallbackRow.total || 0) * 100);
  if (transaction.value && orderCents && transaction.value !== orderCents) {
    return NextResponse.json(
      { ok: false, error: "value_mismatch" },
      { status: 409 },
    );
  }

  if (
    fallbackRow.status === "pago" ||
    fallbackRow.status === "enviado" ||
    fallbackRow.status === "entregue"
  ) {
    return NextResponse.json({ ok: true, already_processed: true });
  }

  let result: ProcessPaymentResult;

  try {
    result = await markOrderPaid({
      orderId: String(fallbackRow.id),
      paidBy: "webhook",
      paymentPatch: {
        endToEndId: transaction.end_to_end_id ?? null,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unknown_error";
    console.error("Erro ao processar pagamento:", message);
    if (String(message).startsWith("insufficient_stock:")) {
      return NextResponse.json(
        { ok: false, error: "insufficient_stock_after_order" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { ok: false, error: "database_error" },
      { status: 500 },
    );
  }

  if (result.alreadyProcessed) {
    return NextResponse.json({ ok: true, already_processed: true });
  }

  if (result.shouldSendPaidEmail) {
    try {
      await sendPaidEmailIfNeeded(result.orderId);
    } catch (error: unknown) {
      console.error("Erro ao enviar email de pagamento PushinPay:", error);
    }
  }

  return NextResponse.json({ ok: true, order_id: result.orderId });
}
