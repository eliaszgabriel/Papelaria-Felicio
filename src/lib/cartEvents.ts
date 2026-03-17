export const CART_ADD_EVENT = "felicio:cart:add";

export type CartAddEventDetail = {
  title?: string;
  qty?: number;
};

export function emitCartAdd(detail: CartAddEventDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CART_ADD_EVENT, { detail }));
}
