"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Container from "@/components/layout/Container";
import { useCart } from "@/components/cart/CartContext";
import { formatShippingPrice } from "@/lib/shipping";
import { maskCEP } from "@/lib/validators";

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default function CartPageClient() {
  const { items, itemsCount, subtotal, removeItem, setQty, clear, cartReady } =
    useCart();

  // Estados de frete
  const [shippingCep, setShippingCep] = useState("");
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState("");
  const [shippingResult, setShippingResult] = useState<null | {
    price: number;
    deadline: string;
  }>(null);

  const isEmpty = cartReady && itemsCount === 0;
  const shippingPrice = shippingResult?.price || 0;
  const total = subtotal + shippingPrice;

  async function calculateShipping() {
    setShippingError("");
    setShippingResult(null);
    setShippingLoading(true);

    try {
      const res = await fetch("/api/shipping/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cep: shippingCep.replace(/\D/g, ""),
          subtotal,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setShippingResult(null);
        setShippingError(data?.error || "Erro ao calcular frete");
      } else {
        setShippingResult({
          price: data.price,
          deadline: data.deadline,
        });
      }
    } catch {
      setShippingResult(null);
      setShippingError("Não consegui calcular o frete agora.");
    } finally {
      setShippingLoading(false);
    }
  }

  return (
    <main className="relative">
      <Container>
        <div className="pt-10 pb-16">
          {/* topo */}
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end sm:gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-felicio-ink">
                Carrinho
              </h1>
              <p className="mt-1 text-sm text-felicio-ink/70">
                Revise seus itens antes de finalizar ✨
              </p>
            </div>

            {cartReady && !isEmpty && (
              <button
                onClick={clear}
                className="text-sm font-semibold text-felicio-ink/70 hover:text-felicio-ink underline underline-offset-4"
              >
                Limpar carrinho
              </button>
            )}
          </div>

          {!cartReady ? (
            <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <div className="rounded-3xl border border-white/60 bg-white/70 backdrop-blur-sm shadow-soft overflow-hidden">
                  <div className="px-6 py-4 border-b border-black/5">
                    <div className="h-4 w-24 animate-pulse rounded-full bg-black/5" />
                  </div>

                  <div className="p-4 sm:p-6 space-y-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div
                        key={`cart-skeleton-${index}`}
                        className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.06)]"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row">
                          <div className="h-20 w-20 rounded-2xl bg-black/5 shrink-0 animate-pulse" />

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="h-4 w-40 animate-pulse rounded-xl bg-black/6" />
                                <div className="mt-2 h-3 w-20 animate-pulse rounded-full bg-black/5" />
                              </div>

                              <div className="h-3 w-16 animate-pulse rounded-full bg-black/5" />
                            </div>

                            <div className="mt-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center sm:gap-4">
                              <div className="h-9 w-28 animate-pulse rounded-full bg-black/5" />
                              <div className="h-4 w-24 animate-pulse rounded-xl bg-black/6" />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4">
                <div className="rounded-3xl border border-white/60 bg-white/70 backdrop-blur-sm shadow-soft p-6">
                  <div className="h-5 w-24 animate-pulse rounded-xl bg-black/6" />
                  <div className="mt-4 space-y-3">
                    <div className="h-24 animate-pulse rounded-2xl bg-black/5" />
                    <div className="h-36 animate-pulse rounded-2xl bg-black/5" />
                    <div className="h-12 animate-pulse rounded-full bg-black/6" />
                  </div>
                </div>
              </div>
            </div>
          ) : isEmpty ? (
            <div className="mt-8 rounded-3xl border border-white/60 bg-white/70 backdrop-blur-sm shadow-soft p-8">
              <p className="text-felicio-ink/80">
                Seu carrinho está vazio. Bora escolher algo fofo? ✨
              </p>
              <Link
                href="/"
                className="mt-5 inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold
                           bg-white border border-felicio-pink/25 text-felicio-ink/90 shadow-soft
                           hover:bg-felicio-pink/10 hover:border-felicio-pink/40
                           hover:shadow-[0_12px_34px_rgba(0,0,0,0.12)]
                           transition"
              >
                Ver produtos
              </Link>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* lista */}
              <div className="lg:col-span-8">
                <div className="rounded-3xl border border-white/60 bg-white/70 backdrop-blur-sm shadow-soft overflow-hidden">
                  <div className="px-6 py-4 border-b border-black/5">
                    <div className="text-sm font-semibold text-felicio-ink">
                      {itemsCount === 1 ? "1 item" : `${itemsCount} itens`}
                    </div>
                  </div>

                  <ul className="p-4 sm:p-6 space-y-3">
                    {items.map((it) => (
                      (() => {
                        const stockCount = Number(it.stock ?? 0);
                        const hasStockInfo = Number.isFinite(stockCount) && stockCount > 0;
                        const outOfStock = Number(it.stock ?? 1) <= 0 && typeof it.stock !== "undefined";
                        const plusDisabled = outOfStock || (hasStockInfo && it.qty >= stockCount);
                        return (
                      <li
                        key={`${it.id}-${it.slug}`}
                        className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.06)]
             hover:bg-felicio-pink/5 transition"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row">
                          <div className="h-20 w-20 rounded-2xl overflow-hidden bg-white border border-black/5 shrink-0">
                            {it.image ? (
                              <Image
                                src={it.image}
                                alt={it.title}
                                width={80}
                                height={80}
                                className="h-full w-full object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="h-full w-full" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <Link
                                  href={`/produtos/${it.slug}`}
                                  className="block text-sm sm:text-base font-extrabold text-felicio-ink truncate"
                                  title={it.title}
                                >
                                  {it.title}
                                </Link>
                                <div className="mt-1 text-sm font-semibold text-felicio-ink/80">
                                  {formatBRL(it.price)}
                                </div>
                                {typeof it.stock !== "undefined" && (
                                  <div className="mt-2 text-xs font-semibold text-felicio-ink/55">
                                    {outOfStock
                                      ? "Produto esgotado no momento"
                                      : hasStockInfo
                                        ? `Estoque disponível: ${stockCount}`
                                        : "Disponibilidade sujeita a confirmação"}
                                  </div>
                                )}
                              </div>

                              <button
                                onClick={() => removeItem(it.id)}
                                className="text-xs sm:text-sm text-felicio-ink/70 hover:text-felicio-ink underline underline-offset-4"
                              >
                                Remover
                              </button>
                            </div>

                            <div className="mt-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center sm:gap-4">
                              {/* qty */}
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setQty(it.id, it.qty - 1)}
                                  className="h-9 w-9 rounded-full border border-black/10 bg-white hover:bg-zinc-50 transition"
                                  aria-label="Diminuir"
                                >
                                  −
                                </button>
                                <div className="w-8 text-center text-sm font-extrabold text-felicio-ink">
                                  {it.qty}
                                </div>
                                <button
                                  onClick={() => setQty(it.id, it.qty + 1)}
                                  disabled={plusDisabled}
                                  className="h-9 w-9 rounded-full border border-black/10 bg-white hover:bg-zinc-50 transition"
                                  aria-label="Aumentar"
                                >
                                  +
                                </button>
                              </div>

                              {/* total item */}
                              <div className="text-sm text-felicio-ink/70">
                                Total:{" "}
                                <span className="font-extrabold text-felicio-ink">
                                  {formatBRL(it.price * it.qty)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                        );
                      })()
                    ))}
                  </ul>
                </div>
              </div>

              {/* resumo */}
              <div className="lg:col-span-4">
                <div className="rounded-3xl border border-white/60 bg-white/70 backdrop-blur-sm shadow-soft p-6">
                  <h2 className="text-base font-extrabold text-felicio-ink">
                    Resumo
                  </h2>

                  {/* Barra de progresso de frete grátis */}
                  {subtotal < 100 && (
                    <div className="mt-4 rounded-2xl border border-felicio-pink/20 bg-felicio-pink/5 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-felicio-ink/80">
                          Frete grátis
                        </span>
                        <span className="text-xs font-extrabold text-felicio-pink">
                          Faltam {formatBRL(100 - subtotal)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-white overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-felicio-pink to-felicio-lilac transition-all duration-300"
                          style={{
                            width: `${Math.min((subtotal / 100) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <p className="mt-2 text-[11px] text-felicio-ink/60">
                        Adicione mais {formatBRL(100 - subtotal)} para ganhar
                        frete grátis!
                      </p>
                    </div>
                  )}

                  {subtotal >= 100 && (
                    <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🎉</span>
                        <div>
                          <p className="text-sm font-extrabold text-green-800">
                            Frete grátis desbloqueado!
                          </p>
                          <p className="text-xs text-green-700">
                            Aproveite o frete grátis para todo o Brasil
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-felicio-ink/70">Subtotal</span>
                      <span className="font-extrabold text-felicio-ink">
                        {formatBRL(subtotal)}
                      </span>
                    </div>

                    <div className="rounded-2xl border border-black/5 bg-white p-4">
                      <div className="text-sm font-extrabold text-felicio-ink">
                        Calcular frete
                      </div>
                      <div className="mt-3 flex gap-2">
                        <input
                          value={shippingCep}
                          onChange={(e) =>
                            setShippingCep(maskCEP(e.target.value))
                          }
                          placeholder="00000-000"
                          className="flex-1 rounded-full border border-black/10 bg-white px-4 py-2 text-sm outline-none
                                     focus:border-felicio-pink/40"
                        />
                        <button
                          onClick={calculateShipping}
                          disabled={shippingLoading}
                          type="button"
                          className="rounded-full px-4 py-2 text-sm font-extrabold bg-white border border-felicio-pink/25
                                     hover:bg-felicio-pink/10 hover:border-felicio-pink/40 transition
                                     disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {shippingLoading ? "..." : "OK"}
                        </button>
                      </div>

                      {shippingError && (
                        <p className="mt-2 text-xs font-semibold text-red-600">
                          {shippingError}
                        </p>
                      )}

                      {shippingResult && (
                        <div className="mt-3 rounded-xl bg-felicio-pink/5 border border-felicio-pink/20 p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-felicio-ink/80">
                              Frete
                            </span>
                            <span className="text-sm font-extrabold text-felicio-pink">
                              {formatShippingPrice(shippingResult.price)}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-felicio-ink/60">
                            {shippingResult.deadline}
                          </p>
                        </div>
                      )}

                      {!shippingResult && !shippingError && (
                        <p className="mt-2 text-[11px] text-felicio-ink/55">
                          {subtotal >= 100
                            ? "Frete grátis para compras acima de R$ 100!"
                            : "Frete R$ 14,90 • Grátis acima de R$ 100"}
                        </p>
                      )}
                    </div>

                    {shippingResult && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-felicio-ink/70">Frete</span>
                        <span className="font-extrabold text-felicio-ink">
                          {formatShippingPrice(shippingResult.price)}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-black/5">
                      <span className="text-felicio-ink/70">Total</span>
                      <span className="text-lg font-extrabold text-felicio-ink">
                        {formatBRL(total)}
                      </span>
                    </div>
                  </div>

                  <Link
                    href="/checkout"
                    className="mt-5 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-extrabold
                               bg-zinc-900 text-white hover:bg-zinc-800 shadow-soft transition"
                  >
                    Finalizar compra
                  </Link>

                  <p className="mt-3 text-[11px] text-felicio-ink/55">
                    Pagamento seguro • Envio com rastreio • Suporte rápido
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Container>
    </main>
  );
}
