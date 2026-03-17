import { onlyDigits } from "./validators";

export type ShippingResult = {
  price: number;
  deadline: string;
  error?: string;
};

/**
 * Calcula um frete simples para a loja.
 *
 * Regras padrao:
 * - subtotal >= 100 => frete gratis
 * - subtotal < 100 => R$ 14,90
 *
 * Overrides uteis para teste:
 * - FORCE_FREE_SHIPPING=1
 * - FREE_SHIPPING_THRESHOLD=0
 * - SHIPPING_FLAT_PRICE=9.9
 */
export function calculateMockShipping(
  subtotal: number,
  cep: string,
): ShippingResult {
  const forceFreeShipping = process.env.FORCE_FREE_SHIPPING === "1";
  const freeShippingThreshold = Number(
    process.env.FREE_SHIPPING_THRESHOLD || 100,
  );
  const flatShippingPrice = Number(process.env.SHIPPING_FLAT_PRICE || 14.9);

  const cleanCep = onlyDigits(cep);

  if (cleanCep.length !== 8) {
    return {
      price: 0,
      deadline: "",
      error: "CEP deve ter 8 digitos",
    };
  }

  if (subtotal < 0) {
    return {
      price: 0,
      deadline: "",
      error: "Subtotal invalido",
    };
  }

  if (forceFreeShipping) {
    return {
      price: 0,
      deadline: "3 a 5 dias uteis",
    };
  }

  if (subtotal >= freeShippingThreshold) {
    return {
      price: 0,
      deadline: "3 a 5 dias uteis",
    };
  }

  return {
    price: Number.isFinite(flatShippingPrice) ? flatShippingPrice : 14.9,
    deadline: "5 a 8 dias uteis",
  };
}

export function formatShippingPrice(price: number): string {
  if (price === 0) {
    return "Gratis";
  }

  return price.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
