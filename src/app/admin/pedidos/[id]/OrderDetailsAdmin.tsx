"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Container from "@/components/layout/Container";
import { Order, OrderItem, OrderStatus, OrderStatusEvent } from "@/lib/orders";
import { STORE } from "@/lib/storeConfig";
import AppToast, { type AppToastState } from "@/components/ui/AppToast";

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

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
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  pago: "Pago",
  enviado: "Enviado",
};

type OrderResponse = {
  ok?: boolean;
  order?: Order;
};

type NotifyResponse = {
  ok?: boolean;
  error?: string;
  whatsappLink?: string;
};

type InvoiceUploadResponse = {
  ok?: boolean;
  error?: string;
  invoice?: {
    url: string;
    filename: string;
    uploadedAt?: number | null;
    sentAt?: number | null;
  };
};

type CustomerWithCpf = Order["customer"] & {
  cpf?: string;
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getItemTotal(item: OrderItem) {
  const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
  return unitPrice * item.qty;
}

function formatCpf(value: string) {
  return value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

function paymentLabel(method: Order["paymentMethod"]) {
  if (method === "pix_auto") return "Pix";
if (method === "card_stripe" || method === "card_mercadopago") return "Cartao";
  return "WhatsApp / manual";
}

export default function OrderDetailsAdmin({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState<AppToastState>({
    open: false,
    title: "",
    message: "",
    tone: "default",
  });
  const [notifyLink, setNotifyLink] = useState("");
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifyError, setNotifyError] = useState("");
  const [tracking, setTracking] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [invoiceUploading, setInvoiceUploading] = useState(false);
  const [invoiceSending, setInvoiceSending] = useState(false);
  const invoiceInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  function showToast(message: string) {
    setToast({
      open: true,
      title: "Atualizacao",
      message,
      tone: "success",
    });

    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
    }

    toastTimeoutRef.current = window.setTimeout(
      () =>
        setToast((current) => ({
          ...current,
          open: false,
        })),
      2200,
    );
  }

  async function copy(text: string, okMsg: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(okMsg);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      showToast(okMsg);
    }
  }

  useEffect(() => {
    const id = String(orderId).trim();
    let alive = true;

    (async () => {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        const data = (await res
          .json()
          .catch(() => null)) as OrderResponse | null;

        if (!alive) {
          return;
        }

        if (!res.ok || !data?.ok || !data.order) {
          setOrder(null);
          setLoaded(true);
          return;
        }

        setOrder(data.order);
        setTracking(data.order.trackingCode ?? "");
        setCarrier(data.order.trackingCarrier ?? "");
        setTrackingUrl(data.order.trackingUrl ?? "");
        setLoaded(true);
      } catch {
        if (!alive) {
          return;
        }

        setOrder(null);
        setLoaded(true);
      }
    })();

    return () => {
      alive = false;
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [orderId]);

  const addressText = useMemo(() => {
    if (!order?.address) return "";
    const address = order.address;
    return [
      address.street,
      address.number,
      address.complement,
      address.district,
      address.city,
      address.uf,
      address.cep,
    ]
      .filter(Boolean)
      .join(", ");
  }, [order]);

  function buildWhatsMessage() {
    if (!order) return "";

    const itemsText = order.items
      .map((item) => {
        return `- ${item.title} (Qtd: ${item.qty}) - ${formatBRL(getItemTotal(item))}`;
      })
      .join("\n");

    return (
      `Pedido Papelaria Felicio\n\n` +
      `Pedido: ${order.id}\n` +
      `Status: ${order.status}\n` +
      `Cliente: ${order.customer.name}\n` +
      `WhatsApp: ${order.customer.whats}\n` +
      (order.customer.email ? `E-mail: ${order.customer.email}\n` : "") +
      (addressText ? `Endereco: ${addressText}\n` : "") +
      `\nItens:\n${itemsText}\n\n` +
      `Total: ${formatBRL(order.total)}\n`
    );
  }

  function openWhats() {
    if (!order) return;
    const url = `https://wa.me/${
      STORE.whatsappNumber
    }?text=${encodeURIComponent(buildWhatsMessage())}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function reloadOrder() {
    const id = String(orderId).trim();
    const res = await fetch(`/api/orders/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as OrderResponse | null;
    if (res.ok && data?.ok && data.order) {
      setOrder(data.order);
    }
  }

  async function setStatus(next: OrderStatus, trackingCode?: string) {
    if (!order) return;

    try {
      const res = await fetch(
        `/api/admin/orders/${encodeURIComponent(order.id)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: next,
            trackingCode: trackingCode?.trim() || "",
            trackingCarrier: carrier.trim() || "",
            trackingUrl: trackingUrl.trim() || "",
          }),
        },
      );

      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
      } | null;

      if (!res.ok || !data?.ok) {
        showToast("Falhou ao atualizar status");
        return;
      }

      setOrder({ ...order, status: next });
      showToast(`Status atualizado: ${STATUS_LABEL[next]}`);
      await reloadOrder();
    } catch {
      showToast("Erro ao atualizar status");
    }
  }

  async function resendEmail(type: "paid" | "shipped" | "invoice") {
    if (!order) return;

    try {
      const res = await fetch(
        `/api/admin/orders/${encodeURIComponent(order.id)}/notify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type }),
        },
      );

      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
      } | null;

      if (!res.ok || !data?.ok) {
        showToast(type === "invoice" ? "Falha ao enviar nota fiscal" : "Falha ao reenviar email");
        return;
      }

      showToast(type === "invoice" ? "Nota fiscal enviada" : "Email reenviado");
      if (type === "invoice") {
        await reloadOrder();
      }
    } catch {
      showToast(type === "invoice" ? "Erro ao enviar nota fiscal" : "Erro ao reenviar email");
    }
  }

  async function uploadInvoice(file: File) {
    if (!order) return;

    setInvoiceUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        `/api/admin/orders/${encodeURIComponent(order.id)}/invoice`,
        {
          method: "POST",
          body: formData,
        },
      );

      const data = (await res.json().catch(() => null)) as InvoiceUploadResponse | null;
      if (!res.ok || !data?.ok || !data.invoice) {
        showToast(data?.error || "Falha ao enviar PDF da nota");
        return;
      }

      setOrder((current) =>
        current
          ? {
              ...current,
              invoice: {
                url: data.invoice!.url,
                filename: data.invoice!.filename,
                uploadedAt: data.invoice!.uploadedAt ?? null,
                sentAt: data.invoice!.sentAt ?? null,
              },
            }
          : current,
      );
      showToast("PDF da nota salvo");
    } catch {
      showToast("Erro ao salvar nota fiscal");
    } finally {
      setInvoiceUploading(false);
      if (invoiceInputRef.current) {
        invoiceInputRef.current.value = "";
      }
    }
  }

  async function onPickInvoice(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    await uploadInvoice(file);
  }

  async function notifyCustomer(nextStatus: string) {
    if (!order) return;

    setNotifyLoading(true);
    setNotifyError("");
    setNotifyLink("");

    try {
      const res = await fetch("/api/notify/order-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          status: nextStatus,
          customerWhats: order.customer.whats,
          total: order.total,
        }),
      });

      const data = (await res
        .json()
        .catch(() => null)) as NotifyResponse | null;

      if (!res.ok) {
        setNotifyError(data?.error || `Falha (${res.status}) ao gerar link.`);
        return;
      }

      if (!data?.ok || !data.whatsappLink) {
        setNotifyError(data?.error || "A API nao retornou o link do WhatsApp.");
        return;
      }

      setNotifyLink(data.whatsappLink);
    } catch {
      setNotifyError("Erro de rede ao gerar link.");
    } finally {
      setNotifyLoading(false);
    }
  }

  if (!loaded) {
    return (
      <main>
        <Container>
          <div className="pt-10 pb-16">
            <div className="rounded-3xl border border-white/60 bg-white/70 p-8">
              <p className="text-felicio-ink/80">Carregando pedido...</p>
            </div>
          </div>
        </Container>
      </main>
    );
  }

  if (!order) {
    return (
      <main>
        <Container>
          <div className="pt-10 pb-16">
            <div className="rounded-3xl border border-white/60 bg-white/70 p-8">
              <p className="text-felicio-ink/80">Pedido nao encontrado.</p>
              <p className="mt-2 text-xs text-felicio-ink/60">
                O admin consulta o pedido salvo no banco. Se ele nao aparecer,
                vale revisar permissao, ID e estado atual do pedido.
              </p>
            </div>
          </div>
        </Container>
      </main>
    );
  }

  const isPaid = order.status === "pago" || order.status === "enviado";
  const isShipped = order.status === "enviado";
  const hasInvoice = Boolean(order.invoice?.url);
  const customer = order.customer as CustomerWithCpf;
  const history: OrderStatusEvent[] =
    order.statusHistory && order.statusHistory.length > 0
      ? order.statusHistory
      : [
          {
            status: order.status,
            at: order.createdAt,
            by: "system",
          },
        ];

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
      />
      <Container>
        <div className="pt-10 pb-16">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Link
                href="/admin/pedidos"
                className="text-sm font-semibold text-felicio-ink/70 underline underline-offset-4 hover:text-felicio-ink"
              >
                Voltar
              </Link>

              <h1 className="mt-3 text-2xl font-extrabold text-felicio-ink/80 sm:text-3xl">
                Admin • {order.id}
              </h1>

              <p className="mt-1 text-sm text-felicio-ink/70">
                {formatDate(order.createdAt)}
              </p>
            </div>

            <span
              className={[
                "rounded-full border px-3 py-1 text-[11px] font-semibold",
                STATUS_STYLE[order.status].className,
              ].join(" ")}
            >
              {STATUS_STYLE[order.status].label}
            </span>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-8">
              <section className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
                <h2 className="text-base font-extrabold text-felicio-ink/80">
                  Cliente
                </h2>
                <div className="mt-4 space-y-2 text-sm text-felicio-ink/80">
                  <div>
                    <span className="font-semibold">Nome:</span>{" "}
                    {order.customer.name}
                  </div>
                  <div>
                    <span className="font-semibold">Whats:</span>{" "}
                    {order.customer.whats}
                  </div>
                  {order.customer.email && (
                    <div>
                      <span className="font-semibold">Email:</span>{" "}
                      {order.customer.email}
                    </div>
                  )}
                  {customer.cpf && (
                    <div>
                      <span className="font-semibold">CPF:</span>{" "}
                      {formatCpf(String(customer.cpf))}
                    </div>
                  )}
                  {addressText && (
                    <div className="pt-2">
                      <span className="font-semibold">Endereco:</span>{" "}
                      {addressText}
                    </div>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    onClick={openWhats}
                    className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-felicio-pink/70 to-felicio-lilac/90 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105 hover:shadow-[0_16px_40px_rgba(244,114,182,0.35)]"
                  >
                    Abrir WhatsApp
                  </button>

                  <button
                    onClick={() =>
                      copy(buildWhatsMessage(), "Mensagem copiada")
                    }
                    className="inline-flex w-full items-center justify-center rounded-full border border-black/5 bg-white/90 px-5 py-3 text-sm font-semibold text-felicio-ink/80 transition hover:bg-white"
                  >
                    Copiar resumo
                  </button>
                </div>
              </section>

              <section className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
                <h2 className="text-base font-extrabold text-felicio-ink/80">
                  Itens
                </h2>
                <div className="mt-4 space-y-3">
                  {order.items.map((item) => (
                    <div
                      key={`${order.id}-${item.id}-${item.slug ?? item.title}`}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white p-4"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-extrabold text-felicio-ink/80">
                          {item.title}
                        </div>
                        <div className="text-sm text-felicio-ink/60">
                          Qtd: {item.qty}
                        </div>
                      </div>
                      <div className="font-extrabold text-felicio-ink/80">
                        {formatBRL(getItemTotal(item))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="lg:col-span-4">
              <div className="sticky top-24 rounded-3xl border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
                <h2 className="text-base font-extrabold text-felicio-ink/80">
                  Acoes (Admin)
                </h2>

                <div className="mt-4 rounded-2xl bg-white p-4">
                  <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-felicio-ink/45">
                    Panorama
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                    <div className="rounded-2xl  border-felicio-pink/15 bg-felicio-pink/8 px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-felicio-ink/50">
                        Pagamento
                      </div>
                      <div className="mt-1 text-sm font-extrabold text-felicio-ink/82">
                        {paymentLabel(order.paymentMethod)}
                      </div>
                    </div>
                    <div className="rounded-2xl  border-felicio-mint/15 bg-felicio-mint/8 px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-felicio-ink/50">
                        Total
                      </div>
                      <div className="mt-1 text-sm font-extrabold text-felicio-ink/82">
                        {formatBRL(order.total)}
                      </div>
                    </div>
                    <div className="rounded-2xl  border-felicio-lilac/15 bg-felicio-lilac/8 px-2 py-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-felicio-ink/50">
                        Status
                      </div>
                      <div className="mt-1 text-sm font-extrabold text-felicio-ink/82">
                        {STATUS_LABEL[order.status]}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <input
                    ref={invoiceInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => void onPickInvoice(e.target.files)}
                  />

                  {order.status === "aguardando_pagamento" && (
                    <button
                      onClick={() => setStatus("pago")}
                      className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-felicio-mint/70 to-felicio-mint/90 px-5 py-3 text-sm font-extrabold text-white transition hover:brightness-105"
                    >
                      Marcar como PAGO
                    </button>
                  )}

                  <div className="mt-3 rounded-2xl border border-black/5 bg-white/80 p-4">
                    <div className="text-xs font-extrabold text-felicio-ink/70">
                      Codigo de rastreio (opcional)
                    </div>

                    <input
                      value={tracking}
                      onChange={(e) => setTracking(e.target.value)}
                      placeholder="Ex: LB123456789BR"
                      className="mt-2 w-full rounded-xl border border-black/5 bg-white px-3 py-2 text-sm outline-none"
                    />

                    <p className="mt-2 text-[11px] text-felicio-ink/60">
                      Se preencher, o cliente vai ver no pedido.
                    </p>
                  </div>

                  <div className="mt-4 text-xs font-extrabold text-felicio-ink/70">
                    Transportadora (opcional)
                  </div>
                  <input
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    placeholder="Ex: Correios / Jadlog / Loggi"
                    className="mt-2 w-full rounded-xl border border-black/5 bg-white px-3 py-2 text-sm outline-none"
                  />

                  <div className="mt-4 text-xs font-extrabold text-felicio-ink/70">
                    Link de rastreio (opcional)
                  </div>
                  <input
                    value={trackingUrl}
                    onChange={(e) => setTrackingUrl(e.target.value)}
                    placeholder="Ex: https://..."
                    className="mt-2 w-full rounded-xl border border-black/5 bg-white px-3 py-2 text-sm outline-none"
                  />

                  {(order.status === "pago" || order.status === "enviado") && (
                    <button
                      onClick={() => setStatus("enviado", tracking)}
                      className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-felicio-lilac/70 to-felicio-lilac/90 px-5 py-3 text-sm font-extrabold text-white transition hover:brightness-105"
                    >
                      Marcar como ENVIADO
                    </button>
                  )}

                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => resendEmail("paid")}
                      disabled={!isPaid}
                      className="inline-flex w-full items-center justify-center rounded-full border border-black/5 bg-white/90 px-5 py-3 text-sm font-semibold text-felicio-ink/80 transition hover:bg-white disabled:opacity-60"
                    >
                      Reenviar email: Pago
                    </button>

                    <button
                      type="button"
                      onClick={() => resendEmail("shipped")}
                      disabled={!isShipped}
                      className="inline-flex w-full items-center justify-center rounded-full border border-black/5 bg-white/90 px-5 py-3 text-sm font-semibold text-felicio-ink/80 transition hover:bg-white disabled:opacity-60"
                    >
                      Reenviar email: Enviado
                    </button>
                  </div>

                  <div className="mt-4 rounded-2xl border border-black/5 bg-white/80 p-4">
                    <div className="text-xs font-extrabold text-felicio-ink/70">
                      Nota fiscal
                    </div>
                    <p className="mt-2 text-[11px] text-felicio-ink/60">
                      Envie o PDF da nota e depois dispare o email para o cliente.
                    </p>

                    {hasInvoice ? (
                      <div className="mt-3 rounded-2xl border border-black/5 bg-white px-3 py-3 text-xs text-felicio-ink/70">
                        <div className="font-semibold text-felicio-ink/80">
                          {order.invoice?.filename}
                        </div>
                        {order.invoice?.uploadedAt ? (
                          <div className="mt-1">
                            Enviado para o pedido em {formatDate(order.invoice.uploadedAt)}
                          </div>
                        ) : null}
                        {order.invoice?.sentAt ? (
                          <div className="mt-1">
                            Email disparado em {formatDate(order.invoice.sentAt)}
                          </div>
                        ) : (
                          <div className="mt-1">Email da nota ainda nao enviado.</div>
                        )}
                      </div>
                    ) : null}

                    <div className="mt-3 grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() => invoiceInputRef.current?.click()}
                        disabled={invoiceUploading}
                        className="inline-flex w-full items-center justify-center rounded-full border border-black/5 bg-white/90 px-5 py-3 text-sm font-semibold text-felicio-ink/80 transition hover:bg-white disabled:opacity-60"
                      >
                        {invoiceUploading
                          ? "Enviando PDF..."
                          : hasInvoice
                            ? "Trocar PDF da nota"
                            : "Adicionar PDF da nota"}
                      </button>

                      {hasInvoice ? (
                        <a
                          href={order.invoice?.url || "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex w-full items-center justify-center rounded-full border border-black/5 bg-white/90 px-5 py-3 text-sm font-semibold text-felicio-ink/80 transition hover:bg-white"
                        >
                          Abrir PDF salvo
                        </a>
                      ) : null}

                      <button
                        type="button"
                        onClick={async () => {
                          setInvoiceSending(true);
                          try {
                            await resendEmail("invoice");
                          } finally {
                            setInvoiceSending(false);
                          }
                        }}
                        disabled={!hasInvoice || invoiceSending}
                        className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-felicio-pink/70 to-felicio-lilac/90 px-5 py-3 text-sm font-extrabold text-white transition hover:brightness-105 disabled:opacity-60"
                      >
                        {invoiceSending ? "Enviando nota..." : "Enviar nota fiscal ao cliente"}
                      </button>
                    </div>
                  </div>
                </div>

                {order.status !== "aguardando_pagamento" && (
                  <div className="mt-4 rounded-2xl border border-black/5 bg-white p-4">
                    <div className="text-xs font-extrabold text-felicio-ink/70">
                      Notificar cliente
                    </div>

                    <div className="mt-2 text-xs text-felicio-ink/60">
                      Para:{" "}
                      <span className="font-semibold text-felicio-ink/75">
                        {order.customer.name}
                      </span>{" "}
                      •{" "}
                      <span className="font-semibold text-felicio-ink/75">
                        {order.customer.whats}
                      </span>
                    </div>

                    {!notifyLink && !notifyError && (
                      <div className="mt-2 text-xs text-felicio-ink/60">
                        Gere o link e depois clique em abrir.
                      </div>
                    )}

                    {notifyError && (
                      <div className="mt-2 text-xs text-felicio-ink/70">
                        {notifyError}
                      </div>
                    )}

                    <div className="mt-3 grid grid-cols-1 gap-2">
                      {!notifyLink ? (
                        <button
                          onClick={() => notifyCustomer(order.status)}
                          disabled={notifyLoading}
                          className="inline-flex w-full items-center justify-center rounded-full border border-black/5 bg-white/90 px-5 py-3 text-sm font-semibold text-felicio-ink/80 transition hover:bg-white disabled:opacity-60"
                        >
                          {notifyLoading
                            ? "Gerando..."
                            : "Gerar mensagem de WhatsApp"}
                        </button>
                      ) : (
                        <a
                          href={notifyLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex w-full items-center justify-center rounded-full border border-felicio-mint/40 bg-white px-5 py-3 text-sm font-extrabold text-felicio-ink/80 transition hover:bg-felicio-mint/10"
                        >
                          Abrir WhatsApp
                        </a>
                      )}

                      <button
                        onClick={() => {
                          setNotifyLink("");
                          setNotifyError("");
                        }}
                        className="inline-flex w-full items-center justify-center rounded-full border border-black/5 bg-white/70 px-5 py-3 text-sm font-semibold text-felicio-ink/60 transition hover:bg-white"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-4 rounded-2xl border border-black/5 bg-white p-4">
                  <div className="text-xs font-extrabold text-felicio-ink/70">
                    Historico
                  </div>

                  <div className="mt-3 space-y-2">
                    {history.map((event, index) => (
                      <div
                        key={`${event.status}-${event.at}-${index}`}
                        className="flex items-start justify-between gap-3"
                      >
                        <div className="text-sm font-semibold text-felicio-ink/80">
                          {STATUS_LABEL[event.status] ?? event.status}
                          <span className="ml-2 text-[11px] text-felicio-ink/50">
                            ({event.by})
                          </span>
                        </div>
                        <div className="shrink-0 text-xs text-felicio-ink/60">
                          {formatDate(event.at)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <h3 className="mt-6 text-sm font-extrabold text-felicio-ink/80">
                  Resumo
                </h3>

                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-felicio-ink/70">Subtotal</span>
                    <span className="font-extrabold text-felicio-ink/90">
                      {formatBRL(order.subtotal)}
                    </span>
                  </div>

                  {typeof order.shippingAmount === "number" && (
                    <div className="flex items-center justify-between">
                      <span className="text-felicio-ink/70">Frete</span>
                      <span className="font-extrabold text-felicio-ink/90">
                        {formatBRL(order.shippingAmount)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-felicio-ink/70">Total</span>
                    <span className="text-lg font-extrabold text-felicio-pink">
                      {formatBRL(order.total)}
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-2">
                  <button
                    onClick={() => copy(order.id, "ID copiado")}
                    className="inline-flex w-full items-center justify-center rounded-full border border-black/5 bg-white/90 px-5 py-3 text-sm font-semibold text-felicio-ink/80 transition hover:bg-white"
                  >
                    Copiar ID do pedido
                  </button>

                  <button
                    onClick={() => copy(STORE.pixKey, "Chave Pix copiada")}
                    className="inline-flex w-full items-center justify-center rounded-full border border-black/5 bg-white/90 px-5 py-3 text-sm font-semibold text-felicio-ink/80 transition hover:bg-white"
                  >
                    Copiar chave Pix da loja
                  </button>
                </div>

                <p className="mt-4 text-[11px] text-felicio-ink/60">
                  Status atualizado aqui altera o pedido salvo no banco de
                  dados.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </main>
  );
}
