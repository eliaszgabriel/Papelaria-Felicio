"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "./CartContext";

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default function MiniCart({ trigger }: { trigger: React.ReactNode }) {
  const { items, itemsCount, subtotal, removeItem, setQty, clear } = useCart();
  const [open, setOpen] = useState(false);

  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const isEmpty = itemsCount === 0;

  const headerText = useMemo(() => {
    if (itemsCount === 0) return "Seu carrinho está vazio";
    if (itemsCount === 1) return "1 item no carrinho";
    return `${itemsCount} itens no carrinho`;
  }, [itemsCount]);

  return (
    <div className="relative inline-flex w-fit" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative inline-flex items-center justify-center align-middle leading-none [appearance:none]"
      >
        {trigger}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-3 w-[360px] max-w-[92vw]">
          <div className="overflow-hidden rounded-2xl border border-white/40 bg-white/95 shadow-[0_22px_80px_rgba(0,0,0,0.22)] backdrop-blur-[2px] will-change-transform animate-[felicio-panel-in_240ms_ease-out]">
            <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
              <div className="text-sm font-semibold text-zinc-900">
                {headerText}
              </div>

              {!isEmpty && (
                <button
                  onClick={clear}
                  className="text-xs text-zinc-700 underline underline-offset-4 hover:text-zinc-900"
                >
                  Limpar
                </button>
              )}
            </div>

            <div className="max-h-[300px] overflow-y-auto overscroll-contain">
              {isEmpty ? (
                <div className="p-5">
                  <p className="text-sm text-zinc-700">
                    Escolha algo fofo para colocar aqui.
                  </p>

                  <Link
                    href="/"
                    onClick={() => setOpen(false)}
                    className="mt-4 inline-flex items-center justify-center rounded-full border border-felicio-pink/25 bg-white px-4 py-2 text-sm font-semibold text-felicio-ink/90 shadow-soft transition hover:border-felicio-pink/40 hover:bg-felicio-pink/10 hover:shadow-[0_12px_34px_rgba(0,0,0,0.12)]"
                  >
                    Ver produtos
                  </Link>
                </div>
              ) : (
                <ul className="space-y-2 p-3">
                  {items.map((it) => (
                    <li
                      key={`${it.id}-${it.slug}`}
                      className="rounded-xl border border-black/5 bg-white p-3 shadow-[0_10px_30px_rgba(0,0,0,0.06)] transition hover:bg-felicio-pink/5"
                    >
                      <div className="flex gap-3">
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-black/5 bg-white">
                          {it.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={it.image}
                              alt={it.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/produtos/${it.slug}`}
                            onClick={() => setOpen(false)}
                            className="block truncate text-sm font-semibold text-zinc-900"
                            title={it.title}
                          >
                            {it.title}
                          </Link>

                          <div className="mt-1 flex items-center justify-between">
                            <div className="text-sm font-semibold text-zinc-800">
                              {formatBRL(it.price)}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setQty(it.id, it.qty - 1)}
                                className="h-8 w-8 rounded-full border border-black/10 bg-white transition hover:bg-zinc-50"
                                aria-label="Diminuir"
                              >
                                -
                              </button>

                              <div className="w-6 text-center text-sm font-semibold text-zinc-900">
                                {it.qty}
                              </div>

                              <button
                                onClick={() => setQty(it.id, it.qty + 1)}
                                className="h-8 w-8 rounded-full border border-black/10 bg-white transition hover:bg-zinc-50"
                                aria-label="Aumentar"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <div className="mt-2 flex items-center justify-between">
                            <div className="text-xs text-zinc-700">
                              Total:{" "}
                              <span className="font-semibold text-zinc-900">
                                {formatBRL(it.price * it.qty)}
                              </span>
                            </div>

                            <button
                              onClick={() => removeItem(it.id)}
                              className="text-xs text-zinc-700 underline underline-offset-4 hover:text-zinc-900"
                            >
                              Remover
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {!isEmpty && (
              <div className="border-t border-black/5 bg-white/70 px-4 py-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-700">Subtotal</span>
                  <span className="font-bold text-zinc-900">
                    {formatBRL(subtotal)}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link
                    href="/carrinho"
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center justify-center rounded-full border border-felicio-pink/25 bg-white px-4 py-2 text-sm font-semibold text-felicio-ink/90 shadow-soft transition hover:border-felicio-pink/40 hover:bg-felicio-pink/10 hover:shadow-[0_12px_34px_rgba(0,0,0,0.12)]"
                  >
                    Ver carrinho
                  </Link>

                  <Link
                    href="/checkout"
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-zinc-800"
                  >
                    Finalizar
                  </Link>
                </div>

                <p className="mt-3 text-[11px] text-zinc-600">
                  Frete e prazo calculados no carrinho.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
