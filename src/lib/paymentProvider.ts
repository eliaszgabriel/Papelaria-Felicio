import { Order } from "@/lib/orders";

export type PaymentStartResult = {
  kind: "redirect";
  url: string;
  message: string;
};

export function startPayment(order: Order): PaymentStartResult {
  return {
    kind: "redirect",
    url: `/pedidos/sucesso?order=${encodeURIComponent(order.id)}`,
    message:
      order.paymentMethod === "whatsapp_pix" ||
      order.paymentMethod === "card_stripe" ||
      order.paymentMethod === "card_mercadopago"
        ? "Redirecionando para o fluxo atual de Pix."
        : "Gerando Pix...",
  };
}
