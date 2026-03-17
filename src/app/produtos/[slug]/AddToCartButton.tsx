"use client";

import { useCart } from "@/components/cart/CartContext";

export default function AddToCartButton({
  product,
}: {
  product: {
    id: string;
    slug: string;
    title: string;
    price: number;
    image?: string;
    stock: number;
  };
}) {
  const { addItem } = useCart();
  const disabled = product.stock <= 0;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        addItem(
          {
            id: product.id,
            slug: product.slug,
            title: product.title,
            price: product.price,
            image: product.image,
          },
          1,
        );
      }}
      className={[
        "mt-6 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-extrabold",
        disabled
          ? "bg-zinc-300 text-zinc-600 cursor-not-allowed"
          : "cursor-pointer bg-zinc-900 text-white hover:bg-zinc-800 shadow-soft transition",
      ].join(" ")}
    >
      {product.stock <= 0
        ? "Esgotado"
        : "Adicionar ao carrinho"}
    </button>
  );
}
