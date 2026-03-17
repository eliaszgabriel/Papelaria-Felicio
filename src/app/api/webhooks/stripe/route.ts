import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { sendNewOrderAdminEmailByOrderId } from "@/lib/adminOrderNotifications";
import { sendPaidEmailIfNeeded } from "@/lib/orderNotifications";
import { markOrderPaid } from "@/lib/orderPayments";
import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

function isPayableEvent(
  eventType: Stripe.Event["type"],
  paymentStatus?: string | null,
) {
  return (
    (eventType === "checkout.session.completed" &&
      paymentStatus === "paid") ||
    eventType === "checkout.session.async_payment_succeeded"
  );
}

export async function POST(req: Request) {
  if (!STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { ok: false, error: "stripe_webhook_not_configured" },
      { status: 500 },
    );
  }

  const rawBody = await req.text();
  const headerStore = await headers();
  const signature = headerStore.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { ok: false, error: "missing_signature" },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      STRIPE_WEBHOOK_SECRET,
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json(
      { ok: false, error: "invalid_signature", message },
      { status: 400 },
    );
  }

  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded"
  ) {
    return NextResponse.json({ ok: true, ignored: true, type: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const orderId = String(session.metadata?.orderId || "").trim();

  if (!orderId) {
    return NextResponse.json(
      { ok: false, error: "missing_order_id" },
      { status: 400 },
    );
  }

  if (!isPayableEvent(event.type, session.payment_status)) {
    return NextResponse.json({
      ok: true,
      ignored: true,
      type: event.type,
      payment_status: session.payment_status,
    });
  }

  try {
    const result = await markOrderPaid({
      orderId,
      paidBy: "stripe",
      paymentPatch: {
        stripeSessionId: session.id,
        stripePaymentIntentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : null,
        paymentStatus: session.payment_status,
      },
    });

    if (result.alreadyProcessed) {
      return NextResponse.json({ ok: true, already_processed: true });
    }

    if (result.shouldSendPaidEmail) {
      try {
        await sendNewOrderAdminEmailByOrderId(result.orderId);
      } catch (error: unknown) {
        console.error("Erro ao enviar email admin Stripe:", error);
      }

      try {
        await sendPaidEmailIfNeeded(result.orderId);
      } catch (error: unknown) {
        console.error("Erro ao enviar email de pagamento Stripe:", error);
      }
    }

    return NextResponse.json({ ok: true, order_id: result.orderId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unknown_error";
    if (String(message).startsWith("insufficient_stock:")) {
      return NextResponse.json(
        { ok: false, error: "insufficient_stock_after_order" },
        { status: 409 },
      );
    }

    if (message === "order_not_found") {
      return NextResponse.json(
        { ok: false, error: "order_not_found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { ok: false, error: "database_error" },
      { status: 500 },
    );
  }
}
