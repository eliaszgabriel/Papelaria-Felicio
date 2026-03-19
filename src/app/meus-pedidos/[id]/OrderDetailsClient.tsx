"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Container from "@/components/layout/Container";
import { Order } from "@/lib/orders";

const STATUS_STYLE: Record<
  Order["status"],
  { label: string; className: string }
> = {
  aguardando_pagamento: {
    label: "Aguardando pagamento",
    className:
      "bg-felicio-pink/10 text-felicio-ink/80 border border-felicio-pink/20",
  },
  pago: {
    label: "Pago",
    className:
      "bg-felicio-mint/20 text-felicio-ink/80 border border-felicio-mint/30",
  },
  enviado: {
    label: "Enviado",
    className:
      "bg-felicio-lilac/15 text-felicio-ink/80 border border-felicio-lilac/25",
  },
  cancelado: {
    label: "Cancelado",
    className:
      "bg-rose-100 text-felicio-ink/80 border border-rose-200",
  },
};

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

function formatDateTime(ts: number) {
  return new Date(ts).toLocaleString("pt-BR");
}

function maskWhats(w: string) {
  const digits = (w || "").replace(/\D/g, "");
  if (digits.length <= 4) return w;
  const end = digits.slice(-4);
  return `(**) *****-${end}`;
}

function maskEmail(e?: string) {
  if (!e) return "";
  const [user, domain] = e.split("@");
  if (!domain) return e;
  const u = user.length <= 3 ? user : `${user.slice(0, 3)}***`;
  return `${u}@${domain}`;
}

function isCorreiosTracking(code?: string | null) {
  if (!code) return false;
  return /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(code.trim().toUpperCase());
}

function correiosTrackingUrl(code: string) {
  return `https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(
    code.trim().toUpperCase(),
  )}`;
}

type OrderHistoryEvent = NonNullable<Order["statusHistory"]>[number];

type CustomerWithCpf = Order["customer"] & {
  cpf?: string;
};

export default function OrderDetailsClient() {
  const params = useParams();
  const id = params?.id;

  const [order, setOrder] = useState<Order | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  function showToast(message: string) {
    setToast(message);
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => setToast(null), 1800);
  }

  async function copy(text: string, okMsg: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(okMsg);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      showToast(okMsg);
    }
  }

  useEffect(() => {
    if (!id) return;

    const rawId = Array.isArray(id) ? id[0] : id;
    const safeId = decodeURIComponent(String(rawId)).trim();

    let alive = true;

    (async () => {
      try {
        const accessToken =
          typeof window === "undefined"
            ? ""
            : localStorage.getItem("felicio_order_access_token") || "";
        const qs = accessToken
          ? `?access=${encodeURIComponent(accessToken)}`
          : "";

        const res = await fetch(`/api/orders/${encodeURIComponent(safeId)}${qs}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (!alive) return;

        if (!res.ok || !data?.ok) {
          setOrder(null);
          return;
        }

        setOrder(data.order);
      } catch {
        if (!alive) return;
        setOrder(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  const addressText = useMemo(() => {
    if (!order?.address) return "";
    const a = order.address;
    return [a.street, a.number, a.complement, a.district, a.city, a.uf, a.cep]
      .filter(Boolean)
      .join(", ");
  }, [order]);

  const history =
    order?.statusHistory && order.statusHistory.length > 0
      ? order.statusHistory
      : order
        ? [{ status: order.status, at: order.createdAt, by: "system" as const }]
        : [];

  const shippingAmount = order
    ? Number(
        order.shippingAmount ??
          Math.max(Number(order.total || 0) - Number(order.subtotal || 0), 0),
      )
    : 0;

  if (!order) {
    return (
      <main>
        <Container>
          <div className="pt-8 pb-14 sm:pt-10 sm:pb-16">
            <Link
              href="/meus-pedidos"
              className="text-sm font-semibold text-felicio-ink/70 underline underline-offset-4 hover:text-felicio-ink"
            >
              Voltar
            </Link>

            <div className="mt-6 rounded-3xl border border-white/60 bg-white/75 p-5 shadow-soft sm:p-8">
              <p className="text-felicio-ink/80">Pedido nao encontrado.</p>
              <p className="mt-2 text-xs text-felicio-ink/60">
                Verifique se o link está correto ou entre em contato com a loja.
              </p>
            </div>
          </div>
        </Container>
      </main>
    );
  }

  const isPaidOrShipped = order.status === "pago" || order.status === "enviado";
  const isPaid = order.status === "pago" || order.status === "enviado";
  const isShipped = order.status === "enviado";
  const isCanceled = order.status === "cancelado";

  return (
    <main>
      <Container>
        <div className="pt-8 pb-14 sm:pt-10 sm:pb-16">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Link
                href="/meus-pedidos"
                className="text-sm font-semibold text-felicio-ink/70 underline underline-offset-4 hover:text-felicio-ink"
              >
                Voltar para meus pedidos
              </Link>

              <h1 className="mt-3 text-2xl font-extrabold text-felicio-ink/80 sm:text-3xl">
                {order.id}
              </h1>

              <p className="mt-1 text-sm text-felicio-ink/70">
                {formatDate(order.createdAt)}
              </p>
            </div>

            <span
              className={[
                "rounded-full px-3 py-1 text-[11px] font-semibold border",
                STATUS_STYLE[order.status].className,
              ].join(" ")}
            >
              {STATUS_STYLE[order.status].label}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:mt-6 sm:grid-cols-3 sm:gap-4">
            <div className="rounded-3xl border border-white/70 bg-white/88 p-4 shadow-soft sm:p-5">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-felicio-ink/45">
                Pagamento
              </div>
              <div className="mt-2 text-base font-extrabold text-felicio-ink/85">
                {order.paymentMethod === "pix_auto"
                  ? "Pix"
      : order.paymentMethod === "card_stripe" ||
          order.paymentMethod === "card_mercadopago"
                    ? "Cartão"
                    : "Pagamento"}
              </div>
              <div className="mt-1 text-xs text-felicio-ink/60">
                {order.status === "aguardando_pagamento"
                  ? "Aguardando confirmação."
                  : "Pedido já confirmado."}
              </div>
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/88 p-4 shadow-soft sm:p-5">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-felicio-ink/45">
                Total
              </div>
              <div className="mt-2 text-base font-extrabold text-felicio-pink">
                {formatBRL(order.total)}
              </div>
              <div className="mt-1 text-xs text-felicio-ink/60">
                Inclui subtotal e frete.
              </div>
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/88 p-4 shadow-soft sm:p-5">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-felicio-ink/45">
                Acompanhamento
              </div>
              <div className="mt-2 text-base font-extrabold text-felicio-ink/85">
                {STATUS_STYLE[order.status].label}
              </div>
              <div className="mt-1 text-xs text-felicio-ink/60">
                Tudo o que você precisa fica aqui.
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:mt-8 lg:grid-cols-12 lg:gap-6">
            <div className="space-y-6 lg:col-span-8">
              <section className="rounded-3xl border border-white/70 bg-white/88 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.08)] sm:p-6">
                <h2 className="text-base font-extrabold text-felicio-ink/80">
                  Status do pedido
                </h2>

                <div className="relative mt-4 grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="absolute left-0 right-0 top-5 h-px bg-black/5" />
                  <div
                    className="absolute left-0 top-5 h-[2px] bg-gradient-to-r from-felicio-pink via-felicio-mint to-felicio-lilac shadow-[0_0_12px_rgba(244,114,182,0.45)] transition-all duration-500"
                    style={{
                      width:
                        order.status === "aguardando_pagamento"
                          ? "33%"
                          : order.status === "pago" || order.status === "enviado"
                            ? "66%"
                            : "100%",
                    }}
                  />

                  <div className="text-center">
                    <div
                      className={[
                        "relative z-10 mx-auto grid h-10 w-10 place-items-center rounded-full border text-[11px] font-extrabold transition",
                        isPaid
                          ? "border-felicio-mint/30 bg-white text-felicio-ink shadow-[0_0_14px_rgba(34,197,94,0.25)]"
                          : "border-felicio-pink/30 bg-white text-felicio-ink shadow-[0_0_14px_rgba(244,114,182,0.35)]",
                      ].join(" ")}
                    >
                      {isPaid ? "OK" : "01"}
                    </div>
                    <div className="mt-2 text-xs font-semibold text-felicio-ink/75">
                      Aguardando
                    </div>
                  </div>

                  <div className="text-center">
                    <div
                      className={[
                        "relative z-10 mx-auto grid h-10 w-10 place-items-center rounded-full border text-[11px] font-extrabold transition",
                        isShipped
                          ? "border-felicio-mint/30 bg-white text-felicio-ink shadow-[0_0_14px_rgba(34,197,94,0.25)]"
                          : isPaid
                            ? "border-felicio-mint/35 bg-white text-felicio-ink shadow-[0_0_14px_rgba(34,197,94,0.35)]"
                            : "border-black/5 bg-white/60 text-felicio-ink/40",
                      ].join(" ")}
                    >
                      {isShipped ? "OK" : "02"}
                    </div>
                    <div
                      className={[
                        "mt-2 text-xs font-semibold",
                        isPaid ? "text-felicio-ink/75" : "text-felicio-ink/40",
                      ].join(" ")}
                    >
                      Pago
                    </div>
                  </div>

                  <div className="text-center">
                    <div
                      className={[
                        "relative z-10 mx-auto grid h-10 w-10 place-items-center rounded-full border text-[11px] font-extrabold transition",
                        isShipped
                          ? "border-felicio-lilac/30 bg-white text-felicio-ink shadow-[0_0_14px_rgba(167,139,250,0.35)]"
                          : "border-black/5 bg-white/60 text-felicio-ink/40",
                      ].join(" ")}
                    >
                      03
                    </div>
                    <div
                      className={[
                        "mt-2 text-xs font-semibold",
                        isShipped ? "text-felicio-ink/75" : "text-felicio-ink/40",
                      ].join(" ")}
                    >
                      Enviado
                    </div>
                  </div>
                </div>

                <div className="mt-4 h-px w-full bg-black/5" />

                <p className="mt-3 text-xs text-felicio-ink/65">
                  {order.status === "aguardando_pagamento" &&
                    "Assim que o pagamento for confirmado, seu pedido avança para Pago."}
                  {order.status === "pago" &&
                    "Pagamento confirmado. Agora estamos preparando seu pedido."}
                  {order.status === "enviado" &&
                    "Seu pedido foi enviado. Em breve você recebe atualizações."}
                </p>

                {history.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-black/5 bg-white/80 p-4">
                    <div className="text-sm font-extrabold text-felicio-ink/80">
                      Histórico
                    </div>

                    <div className="mt-3 space-y-2">
                      {history.map((h: OrderHistoryEvent, i: number) => (
                        <div
                          key={i}
                          className="flex items-start justify-between gap-3"
                        >
                          <div className="text-sm font-semibold text-felicio-ink/80">
                            {STATUS_STYLE[h.status].label}
                          </div>
                          <div className="shrink-0 text-xs text-felicio-ink/60">
                            {formatDateTime(h.at)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-white/70 bg-white/88 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.08)] sm:p-6">
                <h2 className="text-base font-extrabold text-felicio-ink/80">
                  Itens
                </h2>

                <div className="mt-4 space-y-3">
                  {order.items.map((it) => {
                    const unit = Number(it.unitPrice ?? it.price ?? 0);
                    return (
                      <div
                        key={`${order.id}-${it.id}-${it.slug}`}
                        className="flex flex-col items-start justify-between gap-2 rounded-2xl border border-black/5 bg-white p-3.5 sm:flex-row sm:items-center sm:gap-3 sm:p-4"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-extrabold text-felicio-ink/80">
                            {it.title}
                          </div>
                          <div className="mt-1 text-sm text-felicio-ink/60">
                            Quantidade: {it.qty}
                          </div>
                        </div>

                        <div className="whitespace-nowrap text-right">
                          <div className="text-xs text-felicio-ink/50">
                            {formatBRL(unit)} cada
                          </div>
                          <div className="mt-1 font-extrabold text-felicio-ink/80">
                            {formatBRL(unit * it.qty)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-3xl border border-white/70 bg-white/88 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.08)] sm:p-6">
                <h2 className="text-base font-extrabold text-felicio-ink/90">
                  Dados e entrega
                </h2>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-black/5 bg-white/85 p-4 text-sm text-felicio-ink/80">
                    <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-felicio-ink/45">
                      Cliente
                    </div>
                    <div className="mt-3 space-y-2">
                      <div>
                        <span className="font-semibold">Nome:</span>{" "}
                        {order.customer.name}
                      </div>
                      <div>
                        <span className="font-semibold">WhatsApp:</span>{" "}
                        {maskWhats(order.customer.whats)}
                      </div>
                      {order.customer.email && (
                        <div>
                          <span className="font-semibold">E-mail:</span>{" "}
                          {maskEmail(order.customer.email)}
                        </div>
                      )}
                      {(order.customer as CustomerWithCpf).cpf && (
                        <div>
                          <span className="font-semibold">CPF:</span>{" "}
                          {String((order.customer as CustomerWithCpf).cpf).replace(
                            /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
                            "$1.$2.$3-$4",
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/5 bg-white/85 p-4 text-sm text-felicio-ink/80">
                    <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-felicio-ink/45">
                      Entrega
                    </div>
                    <div className="mt-3 space-y-2">
                      <div>
                        <span className="font-semibold">Endereco:</span>{" "}
                        {addressText || "Retirada ou sem endereço informado."}
                      </div>

                      {(order.trackingUrl || order.trackingCode) && (
                        <div className="pt-2">
                          <div className="font-semibold">Rastreio</div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {order.trackingCode ? (
                              <>
                                <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-sm font-extrabold">
                                  {order.trackingCode}
                                </span>

                                <button
                                  type="button"
                                  onClick={() =>
                                    copy(
                                      order.trackingCode!,
                                      "Código de rastreio copiado.",
                                    )
                                  }
                                  className="rounded-full border border-black/10 bg-white px-3 py-1 text-sm font-semibold hover:bg-gray-50"
                                >
                                  Copiar
                                </button>
                              </>
                            ) : (
                              <span className="text-sm text-felicio-ink/70">
                                {order.trackingCarrier
                                  ? `(${order.trackingCarrier})`
                                  : ""}
                              </span>
                            )}

                            {(order.trackingUrl ||
                              (order.trackingCode &&
                                isCorreiosTracking(order.trackingCode))) && (
                              <a
                                href={
                                  order.trackingUrl
                                    ? order.trackingUrl
                                    : correiosTrackingUrl(order.trackingCode!)
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full bg-black px-3 py-1 text-sm font-semibold text-white hover:opacity-90"
                              >
                                Rastrear pedido
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className="lg:col-span-4">
              <div className="rounded-3xl border border-white/70 bg-white/88 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.08)] sm:p-6 lg:sticky lg:top-24">
                {toast && (
                  <div className="rounded-xl border border-felicio-mint/25 bg-felicio-mint/15 px-3 py-2 text-xs font-semibold text-felicio-ink/80">
                    {toast}
                  </div>
                )}

                <h2 className="text-base font-extrabold text-felicio-ink/80">
                  Resumo
                </h2>

                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-felicio-ink/70">Subtotal</span>
                    <span className="font-extrabold text-felicio-ink/90">
                      {formatBRL(order.subtotal)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-felicio-ink/70">Frete</span>
                    <span className="font-extrabold text-felicio-ink/80">
                      {shippingAmount > 0 ? formatBRL(shippingAmount) : "Gratis"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-felicio-pink/20 pt-2">
                    <span className="text-felicio-ink/70">Total</span>
                    <span className="text-lg font-extrabold text-felicio-pink">
                      {formatBRL(order.total)}
                    </span>
                  </div>
                </div>

                {isCanceled ? (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                    <div className="text-sm font-extrabold text-felicio-ink/80">
                      Pedido cancelado
                    </div>
                    <p className="mt-1 text-xs text-felicio-ink/65">
                      O prazo de pagamento expirou. Se quiser, voce pode voltar para a loja e montar um novo pedido.
                    </p>

                    <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <button
                        onClick={() => window.location.assign("/meus-pedidos")}
                        className="inline-flex w-full items-center justify-center rounded-full border border-felicio-pink/25 bg-white px-5 py-3 text-sm font-semibold text-felicio-ink/90 shadow-soft transition hover:border-felicio-pink/40 hover:bg-felicio-pink/10"
                      >
                        Ver pedidos
                      </button>

                      <button
                        onClick={() => window.location.assign("/")}
                        className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-felicio-pink/70 to-felicio-lilac/90 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105 hover:shadow-[0_16px_40px_rgba(244,114,182,0.35)]"
                      >
                        Voltar para a loja
                      </button>
                    </div>
                  </div>
                ) : !isPaidOrShipped ? (
                  <>
                    {order.paymentMethod === "pix_auto" && (
                      <button
                        type="button"
                        onClick={() =>
                          window.location.assign(
                            `/pedidos/sucesso?order=${encodeURIComponent(order.id)}`,
                          )
                        }
                        className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-felicio-pink/70 to-felicio-lilac/90 px-5 py-3 text-sm font-extrabold text-white transition hover:brightness-105 hover:shadow-[0_16px_40px_rgba(244,114,182,0.35)] active:scale-[0.99]"
                      >
                        Ir para pagamento Pix
                      </button>
                    )}

                  {(order.paymentMethod === "card_stripe" ||
                    order.paymentMethod === "card_mercadopago") &&
                      order.payment?.checkoutUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            window.location.assign(
                              String(order.payment?.checkoutUrl),
                            )
                          }
                          className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-felicio-pink/70 to-felicio-lilac/90 px-5 py-3 text-sm font-extrabold text-white transition hover:brightness-105 hover:shadow-[0_16px_40px_rgba(244,114,182,0.35)] active:scale-[0.99]"
                        >
                          Continuar pagamento com cartao
                        </button>
                      )}
                  </>
                ) : (
                  <div className="mt-4 rounded-2xl border border-black/5 bg-white/80 p-4">
                    <div className="text-sm font-extrabold text-felicio-ink/80">
                      {order.status === "enviado"
                        ? "Pedido enviado"
                        : "Pagamento confirmado"}
                    </div>
                    <p className="mt-1 text-xs text-felicio-ink/65">
                      {order.status === "enviado"
                        ? "Seu pedido já foi enviado. Em breve você recebe atualizações."
                        : "Recebemos seu pagamento. Agora é só aguardar a preparação."}
                    </p>

                    <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <button
                        onClick={() => window.location.assign("/meus-pedidos")}
                        className="inline-flex w-full items-center justify-center rounded-full border border-felicio-pink/25 bg-white px-5 py-3 text-sm font-semibold text-felicio-ink/90 shadow-soft transition hover:border-felicio-pink/40 hover:bg-felicio-pink/10"
                      >
                        Ver pedidos
                      </button>

                      <button
                        onClick={() => window.location.assign("/")}
                        className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-felicio-pink/70 to-felicio-lilac/90 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105 hover:shadow-[0_16px_40px_rgba(244,114,182,0.35)]"
                      >
                        Continuar comprando
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </main>
  );
}
