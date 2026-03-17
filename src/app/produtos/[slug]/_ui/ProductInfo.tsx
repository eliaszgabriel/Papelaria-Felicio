"use client";

import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/cart/CartContext";
import { calculateMockShipping } from "@/lib/shipping";
import { emitWishlistUpdated } from "@/lib/wishlistEvents";

const WISHLIST_KEY = "pf_wishlist";

function getLocalWishlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WISHLIST_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

function setLocalWishlist(ids: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(WISHLIST_KEY, JSON.stringify([...new Set(ids)]));
}

type ProductInfoInput = {
  id: string;
  slug: string;
  title: string;
  price: number;
  oldPrice?: number;
  short: string;
  image?: string;
  stock: number;
  badges?: string[];
};

export default function ProductInfo({
  product,
}: {
  product: ProductInfoInput;
}) {
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);
  const [isWished, setIsWished] = useState(false);
  const [wishLoading, setWishLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [wishlistFeedback, setWishlistFeedback] = useState("");
  const [wishlistPulse, setWishlistPulse] = useState(false);
  const [shippingCep, setShippingCep] = useState("");
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState("");
  const [shippingResult, setShippingResult] = useState<null | {
    price: number;
    deadline: string;
  }>(null);
  const wishlistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const priceBRL = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const maxQty = Math.max(0, Number(product.stock ?? 0));
  const outOfStock = maxQty <= 0;
  const lowStock = maxQty > 0 && maxQty <= 5;
  const hasPromo =
    typeof product.oldPrice === "number" && product.oldPrice > product.price;
  const badges = Array.isArray(product.badges)
    ? product.badges.filter(Boolean).slice(0, 2)
    : [];

  useEffect(() => {
    setQty((current) => {
      if (maxQty <= 0) return 1;
      return Math.min(Math.max(1, current), maxQty);
    });
  }, [maxQty]);

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        const user = data?.user;
        setIsLoggedIn(Boolean(user));

        if (user) {
          const wishlistRes = await fetch(
            `/api/account/wishlist?productId=${encodeURIComponent(product.id)}`,
            { cache: "no-store" },
          );
          const wishlistData = await wishlistRes.json().catch(() => ({}));
          if (wishlistRes.ok && wishlistData?.ok) {
            setIsWished(Boolean(wishlistData.contains));
          }
        } else {
          setIsWished(getLocalWishlist().includes(product.id));
        }
      } catch {
        setIsWished(getLocalWishlist().includes(product.id));
      }
    }

    init();
  }, [product.id]);

  useEffect(() => {
    return () => {
      if (wishlistTimerRef.current) {
        clearTimeout(wishlistTimerRef.current);
      }
    };
  }, []);

  function showWishlistFeedback(message: string) {
    setWishlistFeedback(message);
    setWishlistPulse(true);

    if (wishlistTimerRef.current) {
      clearTimeout(wishlistTimerRef.current);
    }

    wishlistTimerRef.current = setTimeout(() => {
      setWishlistFeedback("");
      setWishlistPulse(false);
    }, 1900);
  }

  async function toggleWishlist() {
    if (wishLoading) return;
    setWishLoading(true);

    try {
      if (isLoggedIn) {
        if (isWished) {
          await fetch(`/api/account/wishlist/${encodeURIComponent(product.id)}`, {
            method: "DELETE",
          });
        } else {
          await fetch("/api/account/wishlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId: product.id }),
          });
        }

        const nextWished = !isWished;
        setIsWished(nextWished);
        emitWishlistUpdated({ active: nextWished, title: product.title });
        showWishlistFeedback(
          nextWished ? "Adicionado aos favoritos" : "Removido dos favoritos",
        );
      } else {
        const ids = getLocalWishlist();
        const next = isWished
          ? ids.filter((id) => id !== product.id)
          : [...ids, product.id];

        setLocalWishlist(next);

        const nextWished = !isWished;
        setIsWished(nextWished);
        emitWishlistUpdated({
          count: next.length,
          active: nextWished,
          title: product.title,
        });
        showWishlistFeedback(
          nextWished ? "Adicionado aos favoritos" : "Removido dos favoritos",
        );
      }
    } catch {
      // Mantemos silencioso para não atrapalhar a compra.
    } finally {
      setWishLoading(false);
    }
  }

  function onAdd() {
    if (outOfStock) return;
    const safeQty = Math.min(Math.max(1, qty), maxQty);

    addItem(
      {
        id: product.id,
        slug: product.slug,
        title: product.title,
        price: product.price,
        image: product.image,
        stock: product.stock,
      },
      safeQty,
    );
  }

  async function calculateShipping() {
    const cep = shippingCep.replace(/\D/g, "");

    setShippingError("");
    setShippingResult(null);

    if (cep.length !== 8) {
      setShippingError("Digite um CEP válido com 8 números.");
      return;
    }

    setShippingLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 700));
      const subtotal = product.price * qty;
      const result = calculateMockShipping(subtotal, cep);

      if (result.error) {
        setShippingError(result.error);
      } else {
        setShippingResult({
          price: result.price,
          deadline: result.deadline,
        });
      }
    } catch {
      setShippingError("Não consegui calcular o frete agora.");
    } finally {
      setShippingLoading(false);
    }
  }

  return (
    <div className="rounded-[2rem] border border-white/60 bg-white/80 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.06)] backdrop-blur-sm sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        {badges.map((badge) => (
          <span
            key={badge}
            className="inline-flex rounded-full bg-felicio-pink/14 px-3 py-1 text-xs font-semibold text-felicio-ink/75"
          >
            {badge}
          </span>
        ))}
        {hasPromo && (
          <span className="inline-flex rounded-full bg-felicio-sun/18 px-3 py-1 text-xs font-semibold text-felicio-ink/75">
            Oferta ativa
          </span>
        )}
      </div>

      <h1 className="mt-3 text-2xl font-extrabold text-felicio-ink/90 lg:text-[2rem]">
        {product.title}
      </h1>

      <p className="mt-2.5 text-sm leading-6 text-felicio-ink/64">{product.short}</p>

      <div className="mt-4 flex items-end gap-3">
        <div className="text-[1.9rem] font-extrabold text-felicio-ink lg:text-[2.2rem]">
          {priceBRL(product.price)}
        </div>
        {hasPromo && (
          <div className="pb-1 text-sm text-felicio-ink/40 line-through">
            {priceBRL(Number(product.oldPrice || 0))}
          </div>
        )}
      </div>

      {outOfStock && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
          Produto esgotado
        </div>
      )}

      {lowStock && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
          Últimas {maxQty} unidades
        </div>
      )}

      <div className="relative mt-5 flex flex-wrap items-center gap-2.5">
        {wishlistFeedback && (
          <div className="absolute -top-12 right-0 rounded-full border border-felicio-pink/20 bg-white/95 px-4 py-2 text-xs font-semibold text-felicio-pink shadow-soft animate-[felicio-toast-up_1.9s_ease-out_forwards]">
            {wishlistFeedback}
          </div>
        )}

        <div
          className={`inline-flex items-center rounded-full border border-black/10 bg-white/70 px-2.5 py-1.5 ${outOfStock ? "pointer-events-none opacity-40" : ""}`}
        >
          <button
            onClick={() => setQty((current) => Math.max(1, current - 1))}
            disabled={outOfStock || qty <= 1}
            className="cursor-pointer px-3 text-lg transition hover:text-felicio-pink active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Diminuir quantidade"
          >
            -
          </button>
          <span className="w-8 text-center text-sm font-semibold">{qty}</span>
          <button
            disabled={qty >= maxQty || outOfStock}
            onClick={() => setQty((current) => Math.min(current + 1, maxQty))}
            className="cursor-pointer px-3 text-lg transition hover:text-felicio-pink active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Aumentar quantidade"
          >
            +
          </button>
        </div>

        <button
          onClick={onAdd}
          disabled={outOfStock || qty > maxQty}
          className={`cursor-pointer rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-[0_14px_30px_rgba(0,0,0,0.12)] transition active:scale-[0.98] ${
            outOfStock
              ? "cursor-not-allowed bg-gray-300"
              : "bg-gradient-to-r from-felicio-pink to-felicio-lilac hover:brightness-105"
          }`}
        >
          {outOfStock ? "Esgotado" : "Adicionar ao carrinho"}
        </button>

        <button
          onClick={toggleWishlist}
          disabled={wishLoading}
          title={isWished ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          className={`cursor-pointer rounded-full border px-5 py-2.5 text-sm font-semibold transition active:scale-[0.98] ${
            isWished
              ? "border-felicio-pink/40 bg-felicio-pink/10 text-felicio-pink"
              : "border-black/10 bg-white/70 text-felicio-ink/70 hover:bg-white"
          } ${wishlistPulse ? "animate-[felicio-badge-pop_420ms_ease-out]" : ""}`}
        >
          {isWished ? "Favoritado" : "Favoritar"}
        </button>
      </div>

      <div className="mt-5 rounded-[1.8rem] border border-black/5 bg-white/70 p-4 sm:p-5">
        <div className="text-sm font-semibold text-felicio-ink/80">
          Calcular frete
        </div>
        <div className="mt-3 flex gap-2.5">
          <input
            value={shippingCep}
            onChange={(e) => {
              const only = e.target.value.replace(/\D/g, "").slice(0, 8);
              const masked =
                only.length > 5 ? `${only.slice(0, 5)}-${only.slice(5)}` : only;
              setShippingCep(masked);
            }}
            className="h-12 flex-1 rounded-2xl border border-black/10 bg-white/90 px-4 text-sm outline-none"
            placeholder="Digite seu CEP (ex.: 00000-000)"
          />
          <button
            onClick={calculateShipping}
            disabled={shippingLoading}
            className="h-12 cursor-pointer rounded-2xl border border-black/10 bg-white/90 px-5 text-sm font-semibold transition hover:bg-felicio-pink hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {shippingLoading ? "..." : "OK"}
          </button>
        </div>
        <div className="mt-2 text-xs text-felicio-ink/45">
          Integração com Correios ou Melhor Envio em breve.
        </div>
        {shippingError && (
          <div className="mt-2 text-xs font-semibold text-red-600">
            {shippingError}
          </div>
        )}

        {shippingResult && (
          <div className="mt-3 rounded-2xl border border-black/5 bg-white/80 p-3 text-xs text-felicio-ink/70">
            <div>
              <span className="font-semibold">Frete:</span>{" "}
              {shippingResult.price === 0
                ? "Grátis"
                : shippingResult.price.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
            </div>
            <div className="mt-1">
              <span className="font-semibold">Prazo:</span>{" "}
              {shippingResult.deadline}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-felicio-ink/55">
        <span className="rounded-full bg-white/70 px-3 py-2">
          Pagamento seguro
        </span>
        <span className="rounded-full bg-white/70 px-3 py-2">
          Envio com rastreio
        </span>
        <span className="rounded-full bg-white/70 px-3 py-2">
          Suporte rápido
        </span>
      </div>
    </div>
  );
}

