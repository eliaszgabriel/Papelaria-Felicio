import { escapeHtml, sanitizeEmailUrl } from "@/lib/htmlEscape";

type OrderLike = {
  id: string;
  total: number;
  status: string;
  customer?: { name?: string; email?: string };
  paymentMethod?: string | null;
  createdAt?: number | null;
  trackingCode?: string | null;
  trackingCarrier?: string | null;
  trackingUrl?: string | null;
};

function moneyBR(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function correiosUrl(code: string) {
  return `https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(
    code,
  )}`;
}

function paymentLabel(method?: string | null) {
  if (method === "pix_auto") return "Pix";
  if (method === "card_stripe" || method === "card_mercadopago") return "Cartao";
  return method || "Nao informado";
}

export function paidTemplate(order: OrderLike) {
  const siteUrl = process.env.SITE_URL ?? "";
  const name = escapeHtml(order.customer?.name || "Ola");
  const orderId = escapeHtml(order.id);
  const linkPedido = sanitizeEmailUrl(
    `${siteUrl}/meus-pedidos/${encodeURIComponent(order.id)}`,
  );

  return {
    subject: `Pagamento confirmado - Pedido ${order.id}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>Pagamento confirmado</h2>
        <p>${name}, recebemos o pagamento do seu pedido <b>${orderId}</b>.</p>
        <p><b>Total:</b> ${escapeHtml(moneyBR(order.total))}</p>
        <p>Voce pode acompanhar seu pedido por aqui:</p>
        <p><a href="${linkPedido}">${escapeHtml(linkPedido)}</a></p>
        <hr/>
        <p style="color:#666;font-size:12px">Papelaria Felicio</p>
      </div>
    `,
  };
}

export function shippedTemplate(order: OrderLike) {
  const siteUrl = process.env.SITE_URL ?? "";
  const name = escapeHtml(order.customer?.name || "Ola");
  const orderId = escapeHtml(order.id);
  const linkPedido = sanitizeEmailUrl(
    `${siteUrl}/meus-pedidos/${encodeURIComponent(order.id)}`,
  );

  const hasUrl = !!order.trackingUrl?.trim();
  const hasCode = !!order.trackingCode?.trim();

  let trackingLink = "";
  if (hasUrl) trackingLink = sanitizeEmailUrl(order.trackingUrl!.trim());
  else if (hasCode && /BR$/i.test(order.trackingCode!.trim())) {
    trackingLink = sanitizeEmailUrl(correiosUrl(order.trackingCode!.trim()));
  }

  const carrierLine = order.trackingCarrier?.trim()
    ? `<p><b>Transportadora:</b> ${escapeHtml(order.trackingCarrier.trim())}</p>`
    : "";

  const codeLine = hasCode
    ? `<p><b>Codigo de rastreio:</b> ${escapeHtml(order.trackingCode)}</p>`
    : "";

  const linkLine = trackingLink
    ? `<p><a href="${trackingLink}">Rastrear pedido</a></p>`
    : "<p><i>Rastreio ainda nao disponivel no link, mas ja esta marcado como enviado.</i></p>";

  return {
    subject: `Pedido enviado - ${order.id}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>Seu pedido foi enviado</h2>
        <p>${name}, seu pedido <b>${orderId}</b> ja foi enviado.</p>
        ${carrierLine}
        ${codeLine}
        ${linkLine}
        <p>Detalhes do pedido:</p>
        <p><a href="${linkPedido}">${escapeHtml(linkPedido)}</a></p>
        <hr/>
        <p style="color:#666;font-size:12px">Papelaria Felicio</p>
      </div>
    `,
  };
}

export function newOrderAdminTemplate(order: OrderLike) {
  const siteUrl = process.env.SITE_URL ?? "";
  const adminLink = sanitizeEmailUrl(`${siteUrl}/admin/pedidos`);
  const customerName = escapeHtml(order.customer?.name || "Cliente");
  const customerEmail = escapeHtml(order.customer?.email || "Nao informado");
  const orderId = escapeHtml(order.id);
  const createdAt = order.createdAt
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(order.createdAt)
    : "Agora";

  return {
    subject: `Novo pedido recebido - ${order.id}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55">
        <h2>Novo pedido na loja</h2>
        <p>Um novo pedido acabou de entrar na Papelaria Felicio.</p>
        <p><b>Pedido:</b> ${orderId}</p>
        <p><b>Cliente:</b> ${customerName}</p>
        <p><b>Email:</b> ${customerEmail}</p>
        <p><b>Pagamento:</b> ${escapeHtml(paymentLabel(order.paymentMethod))}</p>
        <p><b>Total:</b> ${escapeHtml(moneyBR(order.total))}</p>
        <p><b>Criado em:</b> ${escapeHtml(createdAt)}</p>
        <p>Abra o admin para revisar os detalhes e seguir com a separacao:</p>
        <p><a href="${adminLink}">${escapeHtml(adminLink)}</a></p>
        <hr />
        <p style="color:#666;font-size:12px">Aviso automatico da loja</p>
      </div>
    `,
  };
}
