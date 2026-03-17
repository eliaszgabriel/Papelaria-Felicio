export const WISHLIST_UPDATED_EVENT = "felicio:wishlist:updated";

export type WishlistUpdatedEventDetail = {
  count?: number;
  active?: boolean;
  title?: string;
};

export function emitWishlistUpdated(detail: WishlistUpdatedEventDetail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WISHLIST_UPDATED_EVENT, { detail }));
}
