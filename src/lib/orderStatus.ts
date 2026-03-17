export type OrderStatus = "aguardando_pagamento" | "pago" | "enviado";

export function getStatusLabel(status: string) {
  if (status === "pago") return "💚 Pago";
  if (status === "enviado") return "💜 Enviado";
  return "💗 Aguardando pagamento";
}

export function getStatusClass(status: string) {
  if (status === "pago") return "bg-felicio-mint/20 border-felicio-mint/30";
  if (status === "enviado")
    return "bg-felicio-lilac/15 border-felicio-lilac/25";
  return "bg-felicio-pink/15 border-felicio-pink/25";
}
