import { onlyDigits } from "./validators";

export type ShippingResult = {
  price: number;
  deadline: string;
  error?: string;
};

/**
 * Calcula frete mock com regra simples:
 * - subtotal >= 100 → frete grátis (3 a 5 dias úteis)
 * - subtotal < 100 → R$ 14,90 (5 a 8 dias úteis)
 * 
 * IMPORTANTE: Esta é uma implementação mock.
 * Futuramente, substituir por integração real com Correios/Melhor Envio.
 */
export function calculateMockShipping(
  subtotal: number,
  cep: string
): ShippingResult {
  // Validar CEP
  const cleanCep = onlyDigits(cep);
  
  if (cleanCep.length !== 8) {
    return {
      price: 0,
      deadline: "",
      error: "CEP deve ter 8 dígitos",
    };
  }

  // Validar subtotal
  if (subtotal < 0) {
    return {
      price: 0,
      deadline: "",
      error: "Subtotal inválido",
    };
  }

  // Regra de frete
  if (subtotal >= 100) {
    return {
      price: 0,
      deadline: "3 a 5 dias úteis",
    };
  }

  return {
    price: 14.90,
    deadline: "5 a 8 dias úteis",
  };
}

/**
 * Formata valor de frete para exibição
 */
export function formatShippingPrice(price: number): string {
  if (price === 0) {
    return "Grátis";
  }
  
  return price.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
