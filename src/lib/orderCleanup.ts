import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";

const DEFAULT_METHODS = ["pix_auto", "card_mercadopago", "card_stripe"];

function getCleanupMinutes() {
  return Math.max(15, Number(process.env.ORDER_CLEANUP_MINUTES || 60));
}

function getCleanupMethods() {
  const raw = String(process.env.ORDER_CLEANUP_METHODS || "").trim();
  if (!raw) return DEFAULT_METHODS;

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function nextCanceledHistory(
  statusHistoryJson: string | null | undefined,
  createdAt: number,
  now: number,
) {
  let history: Array<{ status: string; at: number; by: string }> = [];
  try {
    history = statusHistoryJson ? JSON.parse(statusHistoryJson) : [];
  } catch {
    history = [];
  }

  if (history.length === 0) {
    history.push({
      status: "aguardando_pagamento",
      at: Number(createdAt || 0),
      by: "system",
    });
  }

  const last = history[history.length - 1];
  if (last?.status !== "cancelado") {
    history.push({
      status: "cancelado",
      at: now,
      by: "system",
    });
  }

  return history;
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
  const now = Date.now();

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const result = await pool.query<{
      id: string;
      paymentmethod: string;
      statushistoryjson: string | null;
      createdat: number;
    }>(
      `
      SELECT id, paymentmethod, statushistoryjson, createdat
      FROM orders
      WHERE status = $1
        AND createdat < $2
        AND paymentmethod = ANY($3::text[])
      `,
      ["aguardando_pagamento", cutoff, methods],
    );

    for (const row of result.rows) {
      const history = nextCanceledHistory(
        row.statushistoryjson,
        Number(row.createdat || 0),
        now,
      );

      await pool.query(
        `
        UPDATE orders
        SET status = $1,
            statushistoryjson = $2
        WHERE id = $3
        `,
        ["cancelado", JSON.stringify(history), row.id],
      );
    }

    return {
      ok: true as const,
      expired: result.rowCount ?? 0,
      cutoff,
      minutes,
      methods,
      orders: result.rows.map((row) => ({
        id: row.id,
        paymentmethod: row.paymentmethod,
      })),
    };
  }

  const { db } = await import("@/lib/db");
  const placeholders = methods.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `
      SELECT id, paymentMethod as paymentmethod, statusHistoryJson, createdAt
      FROM orders
      WHERE status = ?
        AND createdAt < ?
        AND paymentMethod IN (${placeholders})
      `,
    )
    .all("aguardando_pagamento", cutoff, ...methods) as Array<{
      id: string;
      paymentmethod: string;
      statusHistoryJson?: string | null;
      createdAt: number;
    }>;

  const updateStmt = db.prepare(
    `
    UPDATE orders
    SET status = ?,
        statusHistoryJson = ?
    WHERE id = ?
    `,
  );

  for (const row of rows) {
    const history = nextCanceledHistory(
      row.statusHistoryJson,
      Number(row.createdAt || 0),
      now,
    );
    updateStmt.run("cancelado", JSON.stringify(history), row.id);
  }

  return {
    ok: true as const,
    expired: rows.length,
    cutoff,
    minutes,
    methods,
    orders: rows.map((row) => ({
      id: row.id,
      paymentmethod: row.paymentmethod,
    })),
  };
}
