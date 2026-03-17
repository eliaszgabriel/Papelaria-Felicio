import { sendEmail } from "@/lib/email";
import { newOrderAdminTemplate } from "@/lib/emailTemplates";
import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";

type AdminOrderNotificationInput = {
  id: string;
  total: number;
  paymentMethod?: string | null;
  createdAt?: number | null;
  customer?: {
    name?: string;
    email?: string;
  };
};

function parseRecipients() {
  return String(process.env.STORE_ORDER_ALERT_EMAILS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseTelegramChatIds() {
  return String(process.env.STORE_ORDER_ALERT_TELEGRAM_CHAT_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function paymentLabel(method?: string | null) {
  if (method === "pix_auto") return "Pix";
  if (method === "card_stripe" || method === "card_mercadopago") return "Cartao";
  return method || "Nao informado";
}

async function sendTelegramMessage(text: string) {
  const botToken = String(process.env.STORE_ORDER_ALERT_TELEGRAM_BOT_TOKEN || "").trim();
  const chatIds = parseTelegramChatIds();

  if (!botToken || chatIds.length === 0) {
    return { ok: false as const, reason: "missing_telegram_config" };
  }

  for (const chatId of chatIds) {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Telegram error: ${res.status} ${body}`);
    }
  }

  return { ok: true as const, chats: chatIds.length };
}

export async function sendNewOrderAdminEmail(order: AdminOrderNotificationInput) {
  const recipients = parseRecipients();
  const tpl = newOrderAdminTemplate({
    ...order,
    status: "novo",
  });

  let emailRecipients = 0;
  if (recipients.length > 0) {
    for (const to of recipients) {
      await sendEmail({
        to,
        subject: tpl.subject,
        html: tpl.html,
      });
    }
    emailRecipients = recipients.length;
  }

  const siteUrl = process.env.SITE_URL ?? "";
  const adminLink = `${siteUrl}/admin/pedidos`;
  const telegramText = [
    "Novo pedido na loja",
    `Pedido: ${order.id}`,
    `Cliente: ${order.customer?.name || "Cliente"}`,
    `Pagamento: ${paymentLabel(order.paymentMethod)}`,
    `Total: ${order.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
    `Admin: ${adminLink}`,
  ].join("\n");

  const telegramResult = await sendTelegramMessage(telegramText).catch((error) => {
    throw error;
  });

  if (emailRecipients === 0 && !telegramResult.ok) {
    return {
      ok: false as const,
      reason: "missing_admin_alert_channels",
    };
  }

  return {
    ok: true as const,
    emailRecipients,
    telegramChats: telegramResult.ok ? telegramResult.chats : 0,
  };
}

type StoredOrderNotificationRow = {
  id: string;
  total: number;
  paymentMethod: string | null;
  createdAt: number | null;
  customerEmail: string | null;
  customerJson: string | null;
};

export async function sendNewOrderAdminEmailByOrderId(orderId: string) {
  let row: StoredOrderNotificationRow | undefined;

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const result = await pool.query<StoredOrderNotificationRow>(
      `
      SELECT
        id,
        total,
        paymentmethod AS "paymentMethod",
        createdat AS "createdAt",
        customeremail AS "customerEmail",
        customerjson AS "customerJson"
      FROM orders
      WHERE id = $1
      LIMIT 1
      `,
      [orderId],
    );
    row = result.rows[0];
  } else {
    const { db } = await import("@/lib/db");
    row = db
      .prepare(
        `
        SELECT
          id,
          total,
          paymentMethod,
          createdAt,
          customerEmail,
          customerJson
        FROM orders
        WHERE id = ?
        LIMIT 1
        `,
      )
      .get(orderId) as StoredOrderNotificationRow | undefined;
  }

  if (!row) {
    return { ok: false as const, reason: "order_not_found" };
  }

  let customerName: string | undefined;
  try {
    const customer = row.customerJson
      ? (JSON.parse(row.customerJson) as { name?: string; email?: string })
      : null;
    customerName = customer?.name;
  } catch {
    customerName = undefined;
  }

  return sendNewOrderAdminEmail({
    id: row.id,
    total: Number(row.total || 0),
    paymentMethod: row.paymentMethod,
    createdAt: row.createdAt,
    customer: {
      name: customerName,
      email: row.customerEmail || undefined,
    },
  });
}
