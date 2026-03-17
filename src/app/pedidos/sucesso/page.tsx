import Image from "next/image";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import ClearCartOnSuccess from "./ClearCartOnSuccess";
import CopyPix from "./CopyPix";
import { sendNewOrderAdminEmailByOrderId } from "@/lib/adminOrderNotifications";
import { getMercadoPagoPayment } from "@/lib/mercadoPago";
import { sendPaidEmailIfNeeded } from "@/lib/orderNotifications";
import { markOrderPaid } from "@/lib/orderPayments";
import { PAYMENT_LABELS } from "@/lib/payments";
import { getStripeClient } from "@/lib/stripe";

type Props = {
  searchParams: Promise<{
    id?: string;
    order?: string;
    session_id?: string;
    payment_id?: string;
    status?: string;
  }>;
};

type SuccessOrderItem = {
  title?: string;
  name?: string;
  qty?: number;
  quantity?: number;
  unitPrice?: number;
  price?: number;
};

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    aguardando_pagamento: "Aguardando pagamento",
    pago: "Pago",
    enviado: "Enviado",
    cancelado: "Cancelado",
  };

  return labels[status] ?? status;
}

function statusClass(status: string) {
  const styles: Record<string, string> = {
    aguardando_pagamento: "border-amber-200 bg-amber-50 text-amber-900",
    pago: "border-emerald-200 bg-emerald-50 text-emerald-900",
    enviado: "border-sky-200 bg-sky-50 text-sky-900",
    cancelado: "border-rose-200 bg-rose-50 text-rose-900",
  };

  return styles[status] ?? "border-black/10 bg-white text-felicio-ink";
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
        statusClass(status),
      ].join(" ")}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
      {statusLabel(status)}
    </span>
  );
}

function nextStepCopy(paymentMethod: string, status: string) {
  if (status === "pago") {
    return "Pagamento confirmado. Agora a loja segue com a separacao e preparo do seu pedido.";
  }

  if (paymentMethod === "card_mercadopago") {
    return "Se o cartao ainda estiver aguardando, o retorno da aprovacao aparece por aqui assim que o pagamento confirmar.";
  }

  return "Seu Pix ja esta pronto. Assim que o pagamento confirmar, a loja continua o preparo normalmente.";
}

export default async function PedidoSucesso({ searchParams }: Props) {
  const sp = await searchParams;
  const orderId = sp.id || sp.order;
  const stripeSessionId = sp.session_id;
  const mercadoPagoPaymentId = sp.payment_id;

  if (!orderId) return notFound();

  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const res = await fetch(`${baseUrl}/api/orders/${encodeURIComponent(orderId)}`, {
    cache: "no-store",
    headers: { cookie: cookieHeader },
  });

  let data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) return notFound();

  let order = data.order;

  if (
    stripeSessionId &&
    order?.paymentMethod === "card_stripe" &&
    order?.status === "aguardando_pagamento"
  ) {
    try {
      const stripe = getStripeClient();
      const session = await stripe.checkout.sessions.retrieve(stripeSessionId);

      if (session.payment_status === "paid") {
        const paymentResult = await markOrderPaid({
          orderId: String(order.id),
          paidBy: "stripe",
          paymentPatch: {
            stripeSessionId: session.id,
            stripePaymentIntentId:
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : null,
            paymentStatus: session.payment_status,
          },
        });

        if (!paymentResult.alreadyProcessed && paymentResult.shouldSendPaidEmail) {
          try {
            await sendNewOrderAdminEmailByOrderId(String(order.id));
          } catch {
            // Mantem silencioso; o webhook ainda pode confirmar depois.
          }

          try {
            await sendPaidEmailIfNeeded(String(order.id));
          } catch {
            // Mantem silencioso; o webhook ainda pode confirmar depois.
          }
        }

        const refreshed = await fetch(
          `${baseUrl}/api/orders/${encodeURIComponent(orderId)}`,
          {
            cache: "no-store",
            headers: { cookie: cookieHeader },
          },
        );
        const refreshedData = await refreshed.json().catch(() => null);
        if (refreshed.ok && refreshedData?.ok) {
          data = refreshedData;
          order = refreshedData.order;
        }
      }
    } catch {
      // Fallback silencioso.
    }
  }

  if (
    mercadoPagoPaymentId &&
    order?.paymentMethod === "card_mercadopago" &&
    order?.status === "aguardando_pagamento"
  ) {
    try {
      const payment = await getMercadoPagoPayment(mercadoPagoPaymentId);

      if (payment.status === "approved") {
        const paymentResult = await markOrderPaid({
          orderId: String(order.id),
          paidBy: "mercadopago",
          paymentPatch: {
            mercadoPagoPaymentId: payment.id,
            mercadoPagoPaymentMethodId: payment.payment_method_id ?? null,
            installments: payment.installments ?? null,
            paymentStatus: payment.status ?? null,
          },
        });

        if (!paymentResult.alreadyProcessed && paymentResult.shouldSendPaidEmail) {
          try {
            await sendNewOrderAdminEmailByOrderId(String(order.id));
          } catch {
            // Mantem silencioso; o webhook ainda pode confirmar depois.
          }

          try {
            await sendPaidEmailIfNeeded(String(order.id));
          } catch {
            // Mantem silencioso; o webhook ainda pode confirmar depois.
          }
        }

        const refreshed = await fetch(
          `${baseUrl}/api/orders/${encodeURIComponent(orderId)}`,
          {
            cache: "no-store",
            headers: { cookie: cookieHeader },
          },
        );
        const refreshedData = await refreshed.json().catch(() => null);
        if (refreshed.ok && refreshedData?.ok) {
          data = refreshedData;
          order = refreshedData.order;
        }
      }
    } catch {
      // Fallback silencioso.
    }
  }

  const qrRaw = order.payment?.qrBase64 || order.payment?.qr_code_base64 || null;
  const qrSrc = !qrRaw
    ? null
    : String(qrRaw).startsWith("data:image")
      ? String(qrRaw)
      : `data:image/png;base64,${qrRaw}`;

  const shippingAmount = Number(
    order.shippingAmount ??
      Math.max(Number(order.total || 0) - Number(order.subtotal || 0), 0),
  );
  const isPix = order.paymentMethod === "pix_auto";
  const isCard =
    order.paymentMethod === "card_mercadopago" ||
    order.paymentMethod === "card_stripe";
  const isAwaitingPayment = order.status === "aguardando_pagamento";
  const mercadoPagoReturnStatus = String(sp.status || "").toLowerCase();
  const cardReturnApproved =
    (order.paymentMethod === "card_mercadopago" &&
      mercadoPagoReturnStatus === "approved") ||
    (order.paymentMethod === "card_stripe" &&
      Boolean(stripeSessionId) &&
      order.status === "pago");
  const shouldClearCart =
    (isPix && isAwaitingPayment) || (!isPix && cardReturnApproved);
  const headline =
    order.status === "pago"
      ? "Pagamento confirmado"
      : isCard
        ? "Pedido recebido"
        : "Pedido confirmado";
  const intro =
    order.status === "pago"
      ? "Seu pagamento entrou certinho e agora voce pode acompanhar os proximos passos."
      : isCard
        ? "Seu pedido foi criado direitinho. Agora estamos aguardando a confirmacao final do pagamento."
        : "Sua compra entrou direitinho e agora voce pode acompanhar os proximos passos.";

  return (
    <main className="min-h-[72vh] py-8 sm:py-12">
      <ClearCartOnSuccess enabled={shouldClearCart} />
      <div className="mx-auto max-w-[68rem] px-3 sm:px-4">
        <div className="relative">
          <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[40px] bg-[radial-gradient(circle_at_top,rgba(255,226,236,0.65),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(254,240,247,0.55),transparent_45%)] blur-2xl" />

          <div className="overflow-hidden rounded-[30px] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(255,248,250,0.84))] p-4 shadow-[0_24px_64px_rgba(0,0,0,0.10)] backdrop-blur-md sm:p-8">
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1.16fr_0.9fr]">
              <div>
                <div
                  className={[
                    "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em]",
                    order.status === "pago"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-amber-200 bg-amber-50 text-amber-900",
                  ].join(" ")}
                >
                  {order.status === "pago" ? "Pagamento aprovado" : "Pedido recebido"}
                </div>

                <div className="mt-4 flex items-center gap-3.5">
                  <div
                    className={[
                      "grid h-14 w-14 place-items-center rounded-full text-xl font-black",
                      order.status === "pago"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700",
                    ].join(" ")}
                  >
                    {order.status === "pago" ? "OK" : "!"}
                  </div>

                  <div>
                    <h1 className="text-[1.7rem] font-extrabold tracking-tight text-felicio-ink sm:text-[1.95rem]">
                      {headline}
                    </h1>
                    <p className="mt-1 text-sm text-felicio-ink/62">
                      {intro}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-sm font-semibold text-felicio-ink">
                    Pedido #{order.id}
                  </span>
                  <StatusBadge status={order.status} />
                  <span className="rounded-full border border-felicio-pink/18 bg-felicio-pink/10 px-3 py-1 text-xs font-semibold text-felicio-ink">
                    {PAYMENT_LABELS[
                      order.paymentMethod as keyof typeof PAYMENT_LABELS
                    ] ?? order.paymentMethod}
                  </span>
                  <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-felicio-ink/70">
                    {new Date(Number(order.createdAt || Date.now())).toLocaleDateString(
                      "pt-BR",
                    )}
                  </span>
                </div>

                <div className="mt-7 grid gap-3.5 sm:grid-cols-2">
                  <div className="rounded-[24px] border border-black/6 bg-white/82 p-4.5">
                    <div className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-felicio-ink/45">
                      Cliente
                    </div>
                    <div className="mt-3 text-base font-extrabold text-felicio-ink">
                      {order.customer?.name || "Cliente"}
                    </div>
                    <div className="mt-1 text-sm text-felicio-ink/60">
                      {order.customer?.email || "Sem email informado"}
                    </div>
                    {order.customer?.whats && (
                      <div className="mt-1 text-sm text-felicio-ink/60">
                        {order.customer.whats}
                      </div>
                    )}
                  </div>

                  <div className="rounded-[24px] border border-black/6 bg-white/82 p-4.5">
                    <div className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-felicio-ink/45">
                      Entrega
                    </div>
                    <div className="mt-3 text-sm leading-relaxed text-felicio-ink/70">
                      {order.address?.street ? (
                        <>
                          {order.address?.street}, {order.address?.number}
                          {order.address?.complement
                            ? `, ${order.address.complement}`
                            : ""}
                          <br />
                          {order.address?.district}
                          <br />
                          {order.address?.city}/{order.address?.uf} -{" "}
                          {order.address?.cep}
                        </>
                      ) : (
                        "Endereco sera confirmado com a loja."
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-[24px] border border-black/6 bg-white/82 p-4.5">
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-felicio-ink/45">
                    Andamento do pagamento
                  </div>
                  <div className="mt-3 text-sm leading-relaxed text-felicio-ink/68">
                    {nextStepCopy(String(order.paymentMethod || ""), String(order.status || ""))}
                  </div>
                </div>

                {order.items && order.items.length > 0 && (
                  <div className="mt-6 rounded-[26px] border border-black/6 bg-white/82 p-4.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-base font-extrabold text-felicio-ink">
                        Itens do pedido
                      </div>
                      <div className="rounded-full border border-black/8 bg-white px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-felicio-ink/55">
                        {order.items.length} item{order.items.length > 1 ? "s" : ""}
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {order.items.map((item: SuccessOrderItem, idx: number) => (
                        <div
                          key={`${order.id}-${idx}`}
                          className="flex items-center justify-between gap-4 rounded-[20px] border border-black/5 bg-white p-3.5"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-felicio-ink">
                              {item.title || item.name || `Item ${idx + 1}`}
                            </div>
                          <div className="mt-1 text-xs text-felicio-ink/55">
                            Quantidade: {item.qty || item.quantity || 1}
                          </div>
                        </div>
                        <div className="text-sm font-extrabold text-felicio-ink">
                          {formatBRL(
                            Number(item.unitPrice ?? item.price ?? 0) *
                              Number(item.qty || item.quantity || 1),
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  </div>
                )}

                {isAwaitingPayment && isPix && order.payment?.pixCopiaECola && (
                    <div className="mt-5 rounded-[26px] border border-felicio-pink/16 bg-white/88 p-4 sm:mt-6 sm:p-5">
                      <div className="text-base font-extrabold text-felicio-ink">
                        Finalize seu Pix
                      </div>
                      <div className="mt-1 text-sm text-felicio-ink/60">
                        Se o pedido ainda estiver aguardando, pague por aqui para confirmar.
                      </div>

                      {qrSrc && (
                        <div className="mt-5 flex justify-center">
                          <div className="rounded-[22px] border border-black/6 bg-white p-3.5 shadow-soft">
                            <Image
                              src={qrSrc}
                              alt="QR Code Pix"
                              width={224}
                              height={224}
                              className="h-52 w-52"
                              unoptimized
                            />
                          </div>
                        </div>
                      )}

                      <div className="mt-5 rounded-[22px] border border-black/6 bg-[#fff9fb] p-4 text-xs leading-relaxed text-felicio-ink/70 break-all">
                        {order.payment.pixCopiaECola}
                      </div>

                      <CopyPix value={order.payment.pixCopiaECola} />

                      <div className="mt-5 rounded-[22px] border border-black/6 bg-[#fffafc] p-4.5">
                        <div className="text-base font-extrabold text-felicio-ink">
                          O que acontece agora
                        </div>
                        <div className="mt-3 space-y-2 text-sm leading-relaxed text-felicio-ink/62">
                          <div>1. Seu pedido fica salvo na sua conta.</div>
                          <div>2. Assim que o pagamento confirmar, a loja continua o preparo.</div>
                          <div>3. Quando houver atualizacao, voce consegue acompanhar pelo site.</div>
                          <div>4. Se voce informou email, a loja tambem pode avisar por la.</div>
                        </div>
                      </div>
                    </div>
                  )}
              </div>

              <div className="space-y-4">
                <div className="rounded-[26px] border border-felicio-pink/16 bg-[linear-gradient(180deg,rgba(255,245,248,0.95),rgba(255,255,255,0.9))] p-4 sm:p-5">
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-felicio-ink/45">
                    Resumo financeiro
                  </div>

                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-felicio-ink/60">Subtotal</span>
                      <span className="font-semibold text-felicio-ink">
                        {formatBRL(Number(order.subtotal || 0))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-felicio-ink/60">Frete</span>
                      <span className="font-semibold text-felicio-ink">
                        {formatBRL(shippingAmount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-black/6 pt-3">
                      <span className="text-felicio-ink/70">Total</span>
                      <span className="text-lg font-extrabold text-felicio-ink">
                        {formatBRL(Number(order.total || 0))}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-[26px] border border-black/6 bg-white/82 p-4 sm:p-5">
                  <div className="text-base font-extrabold text-felicio-ink">
                    {isAwaitingPayment ? "Acompanhe por aqui" : "Proximos passos"}
                  </div>

                  <div className="mt-4 grid gap-2.5 sm:mt-5 sm:gap-3">
                    {isCard && isAwaitingPayment && (
                      <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-relaxed text-amber-900">
                        O pedido ja foi registrado. Se o cartao ainda nao aprovou, acompanhe esta tela ou seus pedidos para ver a atualizacao.
                      </div>
                    )}

                    <Link
                      href={`/meus-pedidos/${encodeURIComponent(String(order.id))}`}
                      className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-felicio-pink to-felicio-lilac px-5 py-3 text-sm font-extrabold text-white shadow-soft transition hover:brightness-105"
                    >
                      {isAwaitingPayment ? "Ver andamento do pedido" : "Acompanhar este pedido"}
                    </Link>
                    <Link
                      href="/conta"
                      className="inline-flex items-center justify-center rounded-full border border-felicio-pink/15 bg-[#fff7f9] px-5 py-3 text-sm font-semibold text-felicio-ink transition hover:bg-white"
                    >
                      Ir para minha conta
                    </Link>
                    <Link
                      href="/"
                      className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-felicio-ink transition hover:bg-[#fff7f9]"
                    >
                      Voltar para a loja
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
