export type CartItem = {
  id: string;
  productId?: string;
  slug: string;
  title: string;
  price: number;
  image?: string;
  variantKey?: string;
  colorName?: string;
  colorImage?: string;
  qty: number;
};

export type CartState = {
  items: CartItem[];
};

export function calcCartCount(items: CartItem[]) {
  return items.reduce((acc, it) => acc + it.qty, 0);
}

export function calcCartTotal(items: CartItem[]) {
  return items.reduce((acc, it) => acc + it.price * it.qty, 0);
}
