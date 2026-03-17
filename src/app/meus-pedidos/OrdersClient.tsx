"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Container from "@/components/layout/Container";

type OrderListItem = {
  id: string;
  createdAt: number;
  status: "aguardando_pagamento" | "pago" | "enviado";
  total: number;
};

const ORDER_ACCESS_KEY = "felicio_order_access_token";

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusUI(status: OrderListItem["status"]) {
  if (status === "pago") {
    return {
      label: "Pago",
      cls: "bg-felicio-mint/20 text-felicio-ink/80 border-felicio-mint/30",
    };
  }

  if (status === "enviado") {
    return {
      label: "Enviado",
      cls: "bg-felicio-lilac/15 text-felicio-ink/80 border-felicio-lilac/25",
    };
  }

  return {
    label: "Aguardando pagamento",
    cls: "bg-felicio-pink/10 text-felicio-ink/80 border-felicio-pink/20",
  };
}

export default function OrdersClient() {
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsLoginOrToken, setNeedsLoginOrToken] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      try {
        const authRes = await fetch("/api/orders/my", { cache: "no-store" });
        if (authRes.ok) {
          const authData = await authRes.json().catch(() => null);
          if (authData?.ok) {
            setOrders(authData.orders || []);
            setNeedsLoginOrToken(false);
            setLoading(false);
            return;
          }
        }

        const savedToken = localStorage.getItem(ORDER_ACCESS_KEY) || "";

        if (!savedToken) {
          setNeedsLoginOrToken(true);
          setLoading(false);
          return;
        }

        const res = await fetch(
          `/api/orders?lookupToken=${encodeURIComponent(savedToken)}`,
          { cache: "no-store" },
        );
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.ok) {
          setOrders([]);
          setNeedsLoginOrToken(true);
          setError("Nao consegui validar o acesso aos seus pedidos.");
          return;
        }

        setOrders(data.orders || []);
        setNeedsLoginOrToken(false);
      } catch {
        setOrders([]);
        setNeedsLoginOrToken(true);
        setError("Falha ao carregar pedidos.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const paidOrShippedCount = useMemo(
    () =>
      orders.filter(
        (order) => order.status === "pago" || order.status === "enviado",
      ).length,
    [orders],
  );

  const latestOrder = orders[0] ?? null;

  return (
    <main>
      <Container>
        <div className="pt-8 pb-14 sm:pt-10 sm:pb-16">
          {needsLoginOrToken && (
            <div className="rounded-3xl border border-white/70 bg-white/85 p-4 shadow-soft sm:p-5">
              <p className="text-sm text-felicio-ink/70">
                Para visualizar pedidos sem login, use o mesmo navegador da compra
                ou entre na sua conta.
              </p>
            </div>
          )}

          {loading && (
            <p className="mt-4 text-sm text-felicio-ink/60">Carregando...</p>
          )}
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-felicio-ink/80 sm:text-3xl">
                Meus pedidos
              </h1>
              <p className="mt-1 text-sm text-felicio-ink/70">
                Seu historico de compras da conta ou deste navegador.
              </p>
            </div>

            <Link
              href="/"
              className="text-sm font-semibold text-felicio-ink/70 underline underline-offset-4 hover:text-felicio-ink"
            >
              Voltar para a loja
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:mt-6 sm:grid-cols-3 sm:gap-4">
            <div className="rounded-3xl border border-white/70 bg-white/88 p-4 shadow-soft sm:p-5">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-felicio-ink/45">
                Total de pedidos
              </div>
              <div className="mt-2 text-2xl font-extrabold text-felicio-ink/85">
                {orders.length}
              </div>
              <div className="mt-1 text-xs text-felicio-ink/60">
                Compras registradas por aqui.
              </div>
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/88 p-4 shadow-soft sm:p-5">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-felicio-ink/45">
                Pagos e enviados
              </div>
              <div className="mt-2 text-2xl font-extrabold text-felicio-ink/85">
                {paidOrShippedCount}
              </div>
              <div className="mt-1 text-xs text-felicio-ink/60">
                Pedidos que ja avancaram no fluxo.
              </div>
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/88 p-4 shadow-soft sm:p-5">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-felicio-ink/45">
                Ultimo pedido
              </div>
              <div className="mt-2 text-2xl font-extrabold text-felicio-pink">
                {latestOrder ? formatBRL(latestOrder.total) : "--"}
              </div>
              <div className="mt-1 text-xs text-felicio-ink/60">
                Valor do pedido mais recente.
              </div>
            </div>
          </div>

          {orders.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-white/60 bg-white/75 p-5 shadow-soft sm:mt-8 sm:p-8">
              <p className="text-felicio-ink/80">
                Ainda nao ha pedidos por aqui. Quando voce finalizar um pedido,
                ele aparece aqui.
              </p>
              <Link
                href="/"
                className="mt-5 inline-flex items-center justify-center rounded-full border border-felicio-pink/25 bg-white px-5 py-3 text-sm font-semibold text-felicio-ink/90 shadow-soft transition hover:border-felicio-pink/40 hover:bg-felicio-pink/10"
              >
                Ver produtos
              </Link>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-3 sm:mt-8 sm:gap-4 xl:grid-cols-2">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/meus-pedidos/${encodeURIComponent(String(order.id).trim())}`}
                  className="block rounded-[28px] border border-white/70 bg-white/90 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.06)] transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_24px_70px_rgba(0,0,0,0.10)] sm:p-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-felicio-ink/45">
                        Pedido
                      </div>
                      <div className="mt-2 truncate text-sm font-extrabold text-felicio-ink/80">
                        {order.id}
                      </div>
                      <div className="mt-1 text-xs text-felicio-ink/60">
                        {formatDate(order.createdAt)}
                      </div>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                        getStatusUI(order.status).cls
                      }`}
                    >
                      {getStatusUI(order.status).label}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-2.5 sm:mt-5 sm:grid-cols-2 sm:gap-3">
                    <div className="rounded-2xl border border-black/5 bg-white/90 p-3.5 sm:p-4">
                      <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-felicio-ink/45">
                        Total
                      </div>
                      <div className="mt-2 text-lg font-extrabold text-felicio-pink">
                        {formatBRL(order.total)}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-black/5 bg-gradient-to-br from-felicio-pink/8 to-felicio-lilac/12 p-3.5 sm:p-4">
                      <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-felicio-ink/45">
                        Acompanhamento
                      </div>
                      <div className="mt-2 text-sm font-semibold text-felicio-ink/80">
                        Ver detalhes do pedido
                      </div>
                      <div className="mt-1 text-xs text-felicio-ink/58">
                        Pagamento, entrega e historico.
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Container>
    </main>
  );
}
