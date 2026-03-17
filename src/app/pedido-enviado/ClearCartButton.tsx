"use client";

import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart/CartContext";

export default function ClearCartButton() {
  const { clear } = useCart();
  const router = useRouter();

  function handle() {
    clear();
    router.push("/");
  }

  return (
    <button
      onClick={handle}
      className="inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-extrabold
                 bg-white border border-felicio-pink/35 text-zinc-500 shadow-soft
                 hover:bg-felicio-pink/10 hover:border-felicio-pink/40 transition"
    >
      Já enviei no WhatsApp ✅ (limpar carrinho)
    </button>
  );
}
