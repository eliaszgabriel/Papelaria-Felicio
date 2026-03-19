export type OrderStatus =
  | "aguardando_pagamento"
  | "pago"
  | "enviado"
  | "cancelado";

export function getStatusLabel(status: string) {
  if (status === "pago") return "Pago";
  if (status === "enviado") return "Enviado";
  if (status === "cancelado") return "Cancelado";
  return "Aguardando pagamento";
}

export function getStatusClass(status: string) {
  if (status === "pago") return "bg-felicio-mint/20 border-felicio-mint/30";
  if (status === "enviado") return "bg-felicio-lilac/15 border-felicio-lilac/25";
  if (status === "cancelado") return "bg-rose-100 border-rose-200";
  return "bg-felicio-pink/15 border-felicio-pink/25";
}
