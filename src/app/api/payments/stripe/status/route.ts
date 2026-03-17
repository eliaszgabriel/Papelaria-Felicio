import { NextResponse } from "next/server";

import { getMercadoPagoStatus } from "@/lib/mercadoPagoConfig";
import { getStripeStatus } from "@/lib/stripeConfig";

export const runtime = "nodejs";

export async function GET() {
  const status = getStripeStatus();
  const mercadoPago = getMercadoPagoStatus();

  return NextResponse.json({
    ok: true,
    stripe: {
      enabled: status.enabled,
      checkoutReady: status.checkoutReady,
      webhookReady: status.webhookReady,
      configured:
        Number(status.hasSecretKey) +
          Number(status.hasPublishableKey) +
          Number(status.hasWebhookSecret) >
        0,
    },
    mercadoPago: {
      enabled: mercadoPago.enabled,
      checkoutReady: mercadoPago.checkoutReady,
      webhookReady: mercadoPago.webhookReady,
      configured:
        Number(mercadoPago.hasAccessToken) +
          Number(mercadoPago.hasWebhookSecret) >
        0,
    },
  });
}
