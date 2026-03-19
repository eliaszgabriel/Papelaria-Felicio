"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Container from "@/components/layout/Container";
import AppToast, { type AppToastState } from "@/components/ui/AppToast";

type OrderRow = {
  id: string;
  createdAt: number;
  status: "aguardando_pagamento" | "pago" | "enviado" | "cancelado";
  total: number;
  paymentMethod: string;
  customer: { name: string; whats: string; email?: string };
};

type OrderStatusFilter = "" | OrderRow["status"];
type OrderSort = "new" | "old" | "high" | "low";
type OrderQuickView =
  | "all"
  | "recent"
  | "awaiting"
  | "paid"
  | "shipped"
  | "canceled";

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

function paymentLabel(method: string) {
  if (method === "pix_auto") return "Pix";
if (method === "card_stripe" || method === "card_mercadopago") return "Cartao";
  return method || "Nao informado";
}

const STATUS_META: Record<OrderRow["status"], { label: string; cls: string }> = {
  aguardando_pagamento: {
    label: "Aguardando",
    cls: "bg-felicio-pink/10 border-felicio-pink/20",
  },
  pago: {
    label: "Pago",
    cls: "bg-felicio-mint/15 border-felicio-mint/25",
  },
  enviado: {
    label: "Enviado",
    cls: "bg-felicio-lilac/10 border-felicio-lilac/20",
  },
  cancelado: {
    label: "Cancelado",
    cls: "bg-rose-100 border-rose-200",
  },
};

export default function AdminOrdersClient() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<OrderStatusFilter>("");
  const [error, setError] = useState<string | null>(null);
  const [quickView, setQuickView] = useState<OrderQuickView>("all");
  const [toast, setToast] = useState<AppToastState>({
    open: false,
    title: "",
    message: "",
    tone: "default",
  });
  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const bootstrappedRef = useRef(false);

  function playNewOrderSound() {
    try {
      const AudioContextCtor =
        window.AudioContext ||
        // @ts-expect-error browser fallback
        window.webkitAudioContext;
      if (!AudioContextCtor) return;

      const ctx = new AudioContextCtor();
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      gain.connect(ctx.destination);

      const frequencies = [784, 988];
      frequencies.forEach((frequency, index) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(frequency, now + index * 0.06);
        osc.connect(gain);
        osc.start(now + index * 0.06);
        osc.stop(now + 0.18 + index * 0.08);
      });

      window.setTimeout(() => {
        void ctx.close().catch(() => undefined);
      }, 800);
    } catch {
      // ignore sound errors
    }
  }

  const counts = useMemo(() => {
    const recentThreshold = Date.now() - 24 * 60 * 60 * 1000;
    const c = {
      aguardando_pagamento: 0,
      pago: 0,
      enviado: 0,
      cancelado: 0,
      total: 0,
      recent: 0,
    };

    for (const o of orders) {
      c.total += 1;
      if (o.status === "aguardando_pagamento") c.aguardando_pagamento += 1;
      if (o.status === "pago") c.pago += 1;
      if (o.status === "enviado") c.enviado += 1;
      if (o.status === "cancelado") c.cancelado += 1;
      if (o.createdAt >= recentThreshold) c.recent += 1;
    }

    return c;
  }, [orders]);

  async function load(options?: { silent?: boolean }) {
    const silent = Boolean(options?.silent);
    if (!silent) setLoading(true);
    setError(null);

    const url = new URL(window.location.origin + "/api/admin/orders");
    if (q.trim()) url.searchParams.set("q", q.trim());
    if (status) url.searchParams.set("status", status);

    try {
      const res = await fetch(url.toString(), { cache: "no-store" });
      const data = await res.json();

      if (res.status === 401) {
        window.location.href = "/admin/login";
        return;
      }

      if (!res.ok || !data?.ok) {
        setError("Falha ao carregar pedidos.");
        setOrders([]);
        if (!silent) setLoading(false);
        return;
      }

      const nextOrders = (data.orders || []) as OrderRow[];
      const nextIds = new Set(nextOrders.map((order) => order.id));

      if (!bootstrappedRef.current) {
        seenOrderIdsRef.current = nextIds;
        bootstrappedRef.current = true;
      } else {
        const newcomers = nextOrders.filter((order) => !seenOrderIdsRef.current.has(order.id));
        if (newcomers.length > 0) {
          const latest = newcomers[0];
          setToast({
            open: true,
            title: newcomers.length === 1 ? "Novo pedido chegou" : `${newcomers.length} novos pedidos`,
            message:
              newcomers.length === 1
                ? `${latest.customer?.name || "Cliente"} • ${formatBRL(latest.total)}`
                : `O pedido mais recente foi de ${latest.customer?.name || "Cliente"} no valor de ${formatBRL(latest.total)}.`,
            tone: "success",
          });
          playNewOrderSound();
        }
        seenOrderIdsRef.current = nextIds;
      }

      setOrders(nextOrders);
      if (!silent) setLoading(false);
    } catch {
      setError("Erro de rede ao carregar pedidos.");
      setOrders([]);
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setInterval(() => void load({ silent: true }), 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status]);

  const [sort, setSort] = useState<OrderSort>("new");
  const sortedOrders = useMemo(() => {
    const recentThreshold = Date.now() - 24 * 60 * 60 * 1000;
    const filtered = orders.filter((order) => {
      if (quickView === "recent") return order.createdAt >= recentThreshold;
      if (quickView === "awaiting") return order.status === "aguardando_pagamento";
      if (quickView === "paid") return order.status === "pago";
      if (quickView === "shipped") return order.status === "enviado";
      if (quickView === "canceled") return order.status === "cancelado";
      return true;
    });

    const arr = [...filtered];
    arr.sort((a, b) => {
      if (sort === "new") return b.createdAt - a.createdAt;
      if (sort === "old") return a.createdAt - b.createdAt;
      if (sort === "high") return b.total - a.total;
      return a.total - b.total;
    });

    return arr;
  }, [orders, quickView, sort]);

  async function copyOrderId(e: React.MouseEvent, orderId: string) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(orderId);
      setToast({
        open: true,
        title: "ID copiado",
        message: orderId,
        tone: "success",
      });
    } catch {
      setToast({
        open: true,
        title: "Nao consegui copiar",
        message: "Tente novamente em alguns segundos.",
        tone: "danger",
      });
    }
  }

  function openCustomerWhats(
    e: React.MouseEvent,
    whats: string,
  ) {
    e.preventDefault();
    e.stopPropagation();
    const digits = String(whats).replace(/\D/g, "");
    if (!digits) return;
    window.open(`https://wa.me/${digits}`, "_blank", "noopener,noreferrer");
  }

  return (
    <main>
      <AppToast
        toast={toast}
        onClose={() =>
          setToast((current) => ({
            ...current,
            open: false,
          }))
        }
        duration={4200}
      />
      <Container>
        <div className="pt-10 pb-16">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-felicio-ink/80">
                Admin • Pedidos
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-sm text-felicio-ink/60">
                  Busque por <b>ID</b>, <b>nome</b> ou <b>Whats</b>. Clique para abrir.
                </span>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-black/5 bg-white/80 px-3 py-1 text-xs text-felicio-ink/70">
                    Total <b>{counts.total}</b>
                  </span>
                  <span className="rounded-full border border-felicio-pink/20 bg-felicio-pink/10 px-3 py-1 text-xs text-felicio-ink/70">
                    Aguardando <b>{counts.aguardando_pagamento}</b>
                  </span>
                  <span className="rounded-full border border-felicio-mint/25 bg-felicio-mint/15 px-3 py-1 text-xs text-felicio-ink/70">
                    Pago <b>{counts.pago}</b>
                  </span>
                  <span className="rounded-full border border-felicio-lilac/20 bg-felicio-lilac/10 px-3 py-1 text-xs text-felicio-ink/70">
                    Enviado <b>{counts.enviado}</b>
                  </span>
                  <span className="rounded-full border border-rose-200 bg-rose-100 px-3 py-1 text-xs text-felicio-ink/70">
                    Cancelado <b>{counts.cancelado}</b>
                  </span>
                  <span className="rounded-full border border-felicio-sun/25 bg-felicio-sun/14 px-3 py-1 text-xs text-felicio-ink/70">
                    Ultimas 24h <b>{counts.recent}</b>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => void load()}
                className="rounded-full border border-black/5 bg-white/90 px-4 py-2 text-sm font-semibold text-felicio-ink/80 transition hover:bg-white"
              >
                Atualizar
              </button>

              <button
                onClick={async () => {
                  await fetch("/api/admin/logout", { method: "POST" });
                  window.location.href = "/admin/login";
                }}
                className="rounded-full border border-black/5 bg-white/90 px-4 py-2 text-sm font-semibold text-felicio-ink/60 transition hover:text-felicio-ink/80"
              >
                Sair
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar: FEL-..., nome, Whats..."
                className="w-full rounded-2xl border border-black/5 bg-white/85 px-4 py-3 text-sm text-felicio-ink/80 outline-none"
              />
            </div>

            <div className="lg:col-span-3">
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as OrderStatusFilter)}
                  className="w-full rounded-2xl border border-black/5 bg-white/85 px-4 py-3 text-sm text-felicio-ink/80 outline-none"
                >
                  <option value="">Todos</option>
                  <option value="aguardando_pagamento">Aguardando</option>
                  <option value="pago">Pago</option>
                  <option value="enviado">Enviado</option>
                  <option value="cancelado">Cancelado</option>
                </select>

                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as OrderSort)}
                  className="w-full rounded-2xl border border-black/5 bg-white/85 px-4 py-3 text-sm text-felicio-ink/80 outline-none"
                >
                  <option value="new">Recentes</option>
                  <option value="old">Antigos</option>
                  <option value="high">Maior</option>
                  <option value="low">Menor</option>
                </select>
              </div>
            </div>

            <div className="lg:col-span-1">
              <button
                onClick={() => void load()}
                className="w-full rounded-2xl bg-gradient-to-r from-felicio-pink/70 to-felicio-lilac/90 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-105"
              >
                Filtrar
              </button>
            </div>
          </div>

          <div className="mt-3 rounded-3xl border border-white/70 bg-white/85 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.08)] sm:p-5">
            <div className="mb-4 flex flex-wrap gap-2">
              {[
                { id: "all", label: "Todos", count: counts.total },
                { id: "recent", label: "Ultimas 24h", count: counts.recent },
                { id: "awaiting", label: "Aguardando", count: counts.aguardando_pagamento },
                { id: "paid", label: "Pagos", count: counts.pago },
                { id: "shipped", label: "Enviados", count: counts.enviado },
                { id: "canceled", label: "Cancelados", count: counts.cancelado },
              ].map((option) => {
                const isActive = quickView === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setQuickView(option.id as OrderQuickView)}
                    className={[
                      "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
                      isActive
                        ? "border-felicio-pink/25 bg-felicio-pink/12 text-felicio-ink/80"
                        : "border-black/5 bg-white/90 text-felicio-ink/65 hover:text-felicio-ink/85",
                    ].join(" ")}
                  >
                    {option.label} <b>{option.count}</b>
                  </button>
                );
              })}
            </div>

            {loading && <p className="text-sm text-felicio-ink/70">Carregando...</p>}
            {error && <p className="text-sm text-felicio-ink/70">{error}</p>}

            {!loading && !error && sortedOrders.length === 0 && (
              <p className="text-sm text-felicio-ink/70">Nenhum pedido encontrado.</p>
            )}

            <div className="mt-3 space-y-2">
              {sortedOrders.map((o) => (
                <Link
                  key={o.id}
                  href={`/admin/pedidos/${encodeURIComponent(o.id)}`}
                  className="block rounded-2xl border border-black/5 bg-white p-4 transition hover:bg-white/90"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate font-extrabold text-felicio-ink/80">
                          {o.id}
                        </div>
                        {o.createdAt >= Date.now() - 60 * 60 * 1000 && (
                          <span className="rounded-full border border-felicio-sun/25 bg-felicio-sun/14 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-felicio-ink/75">
                            Novo
                          </span>
                        )}
                      </div>

                      <div className="mt-1 text-sm text-felicio-ink/60">
                        {o.customer?.name} • {o.customer?.whats}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-felicio-ink/60">
                        {formatDate(o.createdAt)}
                        <span className="rounded-full border border-black/5 bg-white/90 px-2.5 py-1 font-semibold text-felicio-ink/65">
                          {paymentLabel(o.paymentMethod)}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={(e) => void copyOrderId(e, o.id)}
                          className="rounded-full border border-black/5 bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-felicio-ink/70 transition hover:text-felicio-ink/85"
                        >
                          Copiar ID
                        </button>
                        {o.customer?.whats ? (
                          <button
                            type="button"
                            onClick={(e) => openCustomerWhats(e, o.customer.whats)}
                            className="rounded-full border border-felicio-mint/25 bg-felicio-mint/15 px-3 py-1.5 text-[11px] font-semibold text-felicio-ink/75 transition hover:bg-felicio-mint/22"
                          >
                            Abrir Whats
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div
                        className={[
                          "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold text-felicio-ink/80",
                          STATUS_META[o.status].cls,
                        ].join(" ")}
                      >
                        {STATUS_META[o.status].label}
                      </div>
                      <div className="mt-2 font-extrabold text-felicio-ink/80">
                        {formatBRL(o.total)}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </main>
  );
}
