"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CART_ADD_EVENT, CartAddEventDetail } from "@/lib/cartEvents";

export default function CartToast() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState<string>("");
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    function onAdded(e: Event) {
      const detail = (e as CustomEvent<CartAddEventDetail>).detail;

      setTitle(detail?.title ?? "Item adicionado");
      setOpen(true);

      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setOpen(false), 2200);
    }

    window.addEventListener(CART_ADD_EVENT, onAdded as EventListener);
    return () => {
      window.removeEventListener(CART_ADD_EVENT, onAdded as EventListener);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  if (!open) return null;

  return (
    <div className="fixed right-4 top-4 z-[9999] pointer-events-none">
      <div
        className={[
          "pointer-events-auto rounded-2xl border border-black/5 bg-white",
          "shadow-[0_18px_60px_rgba(0,0,0,0.18)]",
          "px-4 py-3 w-[320px] max-w-[90vw]",
          "will-change-transform",
          "transition-all duration-200",
          "opacity-100 translate-y-0 scale-100",
        ].join(" ")}
        aria-hidden={false}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-extrabold text-felicio-ink">
              Adicionado ao carrinho ✨
            </div>
            <div
              className="mt-1 text-xs text-felicio-ink/70 truncate"
              title={title}
            >
              {title}
            </div>
          </div>

          <span className="shrink-0 rounded-full bg-felicio-pink/15 text-felicio-pink px-2 py-1 text-[11px] font-extrabold">
            OK
          </span>
        </div>

        <div className="mt-3 flex gap-2">
          <Link
            href="/carrinho"
            className="flex-1 inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-extrabold
                       bg-white border border-felicio-pink/25 text-felicio-ink/90 shadow-soft
                       hover:bg-felicio-pink/10 hover:border-felicio-pink/40 transition"
          >
            Ver carrinho
          </Link>

          <Link
            href="/checkout"
            className="flex-1 inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-extrabold
                       bg-zinc-900 text-white hover:bg-zinc-800 shadow-soft transition"
          >
            Finalizar
          </Link>
        </div>
      </div>
    </div>
  );
}
