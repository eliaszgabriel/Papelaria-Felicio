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
  if (method === "card_stripe" || method === "card_mercadopago") return "Cartão";
  return method || "Não informado";
}

export function paidTemplate(order: OrderLike) {
  const siteUrl = process.env.SITE_URL ?? "";
  const name = order.customer?.name || "Olá";
  const linkPedido = `${siteUrl}/meus-pedidos/${order.id}`;

  return {
    subject: `✅ Pagamento confirmado — Pedido ${order.id}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>Pagamento confirmado 🎉</h2>
        <p>${name}, recebemos o pagamento do seu pedido <b>${order.id}</b>.</p>
        <p><b>Total:</b> ${moneyBR(order.total)}</p>
        <p>Você pode acompanhar seu pedido por aqui:</p>
        <p><a href="${linkPedido}">${linkPedido}</a></p>
        <hr/>
        <p style="color:#666;font-size:12px">Papelaria Felicio</p>
      </div>
    `,
  };
}

export function shippedTemplate(order: OrderLike) {
  const siteUrl = process.env.SITE_URL ?? "";
  const name = order.customer?.name || "Olá";
  const linkPedido = `${siteUrl}/meus-pedidos/${order.id}`;

  const hasUrl = !!order.trackingUrl?.trim();
  const hasCode = !!order.trackingCode?.trim();

  let trackingLink = "";
  if (hasUrl) trackingLink = order.trackingUrl!.trim();
  else if (hasCode && /BR$/i.test(order.trackingCode!.trim()))
    trackingLink = correiosUrl(order.trackingCode!.trim());

  const carrierLine = order.trackingCarrier?.trim()
    ? `<p><b>Transportadora:</b> ${order.trackingCarrier.trim()}</p>`
    : "";

  const codeLine = hasCode
    ? `<p><b>Código de rastreio:</b> ${order.trackingCode}</p>`
    : "";

  const linkLine = trackingLink
    ? `<p><a href="${trackingLink}">📦 Rastrear pedido</a></p>`
    : `<p><i>Rastreio ainda não disponível no link, mas já está marcado como enviado.</i></p>`;

  return {
    subject: `📦 Pedido enviado — ${order.id}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>Seu pedido foi enviado 🚚</h2>
        <p>${name}, seu pedido <b>${order.id}</b> já foi enviado.</p>
        ${carrierLine}
        ${codeLine}
        ${linkLine}
        <p>Detalhes do pedido:</p>
        <p><a href="${linkPedido}">${linkPedido}</a></p>
        <hr/>
        <p style="color:#666;font-size:12px">Papelaria Felicio</p>
      </div>
    `,
  };
}

export function newOrderAdminTemplate(order: OrderLike) {
  const siteUrl = process.env.SITE_URL ?? "";
  const adminLink = `${siteUrl}/admin/pedidos`;
  const customerName = order.customer?.name || "Cliente";
  const customerEmail = order.customer?.email || "Não informado";
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
        <p><b>Pedido:</b> ${order.id}</p>
        <p><b>Cliente:</b> ${customerName}</p>
        <p><b>Email:</b> ${customerEmail}</p>
        <p><b>Pagamento:</b> ${paymentLabel(order.paymentMethod)}</p>
        <p><b>Total:</b> ${moneyBR(order.total)}</p>
        <p><b>Criado em:</b> ${createdAt}</p>
        <p>Abra o admin para revisar os detalhes e seguir com a separação:</p>
        <p><a href="${adminLink}">${adminLink}</a></p>
        <hr />
        <p style="color:#666;font-size:12px">Aviso automático da loja</p>
      </div>
    `,
  };
}
