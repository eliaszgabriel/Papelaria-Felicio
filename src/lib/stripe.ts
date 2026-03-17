import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";

let stripeClient: Stripe | null = null;

export function getStripeClient() {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("stripe_not_configured");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(STRIPE_SECRET_KEY);
  }

  return stripeClient;
}
