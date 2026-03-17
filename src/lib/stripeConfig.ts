const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

export function getStripeStatus() {
  const hasSecretKey = Boolean(STRIPE_SECRET_KEY);
  const hasPublishableKey = Boolean(STRIPE_PUBLISHABLE_KEY);
  const hasWebhookSecret = Boolean(STRIPE_WEBHOOK_SECRET);
  const checkoutReady = hasSecretKey && hasPublishableKey;
  const webhookReady = hasSecretKey && hasWebhookSecret;

  return {
    enabled: checkoutReady && hasWebhookSecret,
    checkoutReady,
    webhookReady,
    hasSecretKey,
    hasPublishableKey,
    hasWebhookSecret,
  };
}
