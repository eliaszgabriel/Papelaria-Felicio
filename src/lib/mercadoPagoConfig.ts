const MERCADOPAGO_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || "";
const MERCADOPAGO_WEBHOOK_SECRET =
  process.env.MERCADOPAGO_WEBHOOK_SECRET || "";

export function getMercadoPagoStatus() {
  const hasAccessToken = Boolean(MERCADOPAGO_ACCESS_TOKEN);
  const hasWebhookSecret = Boolean(MERCADOPAGO_WEBHOOK_SECRET);

  return {
    enabled: hasAccessToken,
    checkoutReady: hasAccessToken,
    webhookReady: hasAccessToken && hasWebhookSecret,
    hasAccessToken,
    hasWebhookSecret,
  };
}
