export type PaymentMethod =
  | "whatsapp_pix"
  | "pix_auto"
  | "card_stripe"
  | "card_mercadopago";

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  whatsapp_pix: "Pix",
  pix_auto: "Pix",
  card_stripe: "Cartao",
  card_mercadopago: "Cartao",
};
