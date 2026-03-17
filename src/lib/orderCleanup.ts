import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";

const DEFAULT_METHODS = ["card_mercadopago", "card_stripe"];

function getCleanupMinutes() {
  return Math.max(15, Number(process.env.ORDER_CLEANUP_MINUTES || 30));
}

function getCleanupMethods() {
  const raw = String(process.env.ORDER_CLEANUP_METHODS || "").trim();
  if (!raw) return DEFAULT_METHODS;

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getOrderCleanupConfig() {
  const secret = String(process.env.ORDER_CLEANUP_SECRET || "").trim();
  return {
    secret,
    minutes: getCleanupMinutes(),
    methods: getCleanupMethods(),
  };
}

export async function cleanupExpiredPendingOrders() {
  const { minutes, methods } = getOrderCleanupConfig();
  const cutoff = Date.now() - minutes * 60 * 1000;

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const result = await pool.query<{ id: string; paymentmethod: string }>(
      `
      DELETE FROM orders
      WHERE status = $1
        AND createdat < $2
        AND paymentmethod = ANY($3::text[])
      RETURNING id, paymentmethod
      `,
      ["aguardando_pagamento", cutoff, methods],
    );

    return {
      ok: true as const,
      deleted: result.rowCount ?? 0,
      cutoff,
      minutes,
      methods,
      orders: result.rows,
    };
  }

  const { db } = await import("@/lib/db");
  const placeholders = methods.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `
      SELECT id, paymentMethod as paymentmethod
      FROM orders
      WHERE status = ?
        AND createdAt < ?
        AND paymentMethod IN (${placeholders})
      `,
    )
    .all("aguardando_pagamento", cutoff, ...methods) as Array<{
      id: string;
      paymentmethod: string;
    }>;

  db.prepare(
    `
    DELETE FROM orders
    WHERE status = ?
      AND createdAt < ?
      AND paymentMethod IN (${placeholders})
    `,
  ).run("aguardando_pagamento", cutoff, ...methods);

  return {
    ok: true as const,
    deleted: rows.length,
    cutoff,
    minutes,
    methods,
    orders: rows,
  };
}
