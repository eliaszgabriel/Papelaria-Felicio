import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";

type PaymentHistoryEvent = {
  status: string;
  at: number;
  by: string;
};

type OrderItemSnapshot = {
  productId?: string;
  qty?: number;
};

type MarkOrderPaidOptions = {
  orderId: string;
  paymentPatch?: Record<string, unknown>;
  paidBy?: string;
};

type MarkOrderPaidResult =
  | { alreadyProcessed: true; shouldSendPaidEmail: false }
  | {
      alreadyProcessed: false;
      orderId: string;
      shouldSendPaidEmail: boolean;
    };

export async function markOrderPaid({
  orderId,
  paymentPatch,
  paidBy = "webhook",
}: MarkOrderPaidOptions): Promise<MarkOrderPaidResult> {
  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const currentResult = await client.query<Record<string, unknown>>(
        `SELECT id, status,
                statushistoryjson AS "statusHistoryJson",
                paymentjson AS "paymentJson",
                createdat AS "createdAt",
                itemsjson AS "itemsJson",
                stockdeductedat AS "stockDeductedAt",
                paidnotifiedat AS "paidNotifiedAt"
         FROM orders
         WHERE id = $1
         LIMIT 1`,
        [orderId],
      );
      const currentRow = currentResult.rows[0];

      if (!currentRow) {
        throw new Error("order_not_found");
      }

      if (
        currentRow.status === "pago" ||
        currentRow.status === "enviado" ||
        currentRow.status === "entregue"
      ) {
        await client.query("ROLLBACK");
        return {
          alreadyProcessed: true as const,
          shouldSendPaidEmail: false as const,
        };
      }

      const now = Date.now();
      const shouldDeductStock = !currentRow.stockDeductedAt;
      const shouldSendPaidEmail = !currentRow.paidNotifiedAt;

      let history: PaymentHistoryEvent[] = [];
      try {
        history = currentRow.statusHistoryJson
          ? (JSON.parse(String(currentRow.statusHistoryJson)) as PaymentHistoryEvent[])
          : [];
      } catch {
        history = [];
      }

      if (history.length === 0) {
        history.push({
          status: "aguardando_pagamento",
          at: Number(currentRow.createdAt),
          by: "system",
        });
      }

      const last = history[history.length - 1];
      if (last?.status !== "pago") {
        history.push({ status: "pago", at: now, by: paidBy });
      }

      let payment: Record<string, unknown> | null = null;
      try {
        payment = currentRow.paymentJson
          ? (JSON.parse(String(currentRow.paymentJson)) as Record<string, unknown>)
          : null;
      } catch {
        payment = null;
      }

      if (payment) {
        payment.status = "paid";
        if (paymentPatch) {
          Object.assign(payment, paymentPatch);
        }
      }

      if (shouldDeductStock) {
        const items = currentRow.itemsJson
          ? (JSON.parse(String(currentRow.itemsJson)) as OrderItemSnapshot[])
          : [];

        for (const item of items) {
          if (!item.productId || !item.qty) continue;

          const deduction = await client.query(
            `UPDATE products
             SET stock = stock - $1
             WHERE id = $2 AND stock >= $3`,
            [item.qty, item.productId, item.qty],
          );

          if (deduction.rowCount !== 1) {
            throw new Error(`insufficient_stock:${item.productId}`);
          }
        }
      }

      await client.query(
        `UPDATE orders
         SET status = $1,
             statushistoryjson = $2,
             paymentjson = $3,
             stockdeductedat = COALESCE(stockdeductedat, $4)
         WHERE id = $5`,
        [
          "pago",
          JSON.stringify(history),
          payment ? JSON.stringify(payment) : currentRow.paymentJson,
          shouldDeductStock ? now : null,
          String(currentRow.id),
        ],
      );

      await client.query("COMMIT");
      return {
        alreadyProcessed: false as const,
        orderId: String(currentRow.id),
        shouldSendPaidEmail,
      };
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      throw error;
    } finally {
      client.release();
    }
  }

  const { db } = await import("@/lib/db");
  const processPayment = db.transaction(() => {
    const currentRow = db
      .prepare(
        `SELECT id, status, statusHistoryJson, paymentJson, createdAt, itemsJson,
                stockDeductedAt, paidNotifiedAt
         FROM orders
         WHERE id = ?
         LIMIT 1`,
      )
      .get(orderId) as Record<string, unknown> | undefined;

    if (!currentRow) {
      throw new Error("order_not_found");
    }

    if (
      currentRow.status === "pago" ||
      currentRow.status === "enviado" ||
      currentRow.status === "entregue"
    ) {
      return {
        alreadyProcessed: true as const,
        shouldSendPaidEmail: false as const,
      };
    }

    const now = Date.now();
    const shouldDeductStock = !currentRow.stockDeductedAt;
    const shouldSendPaidEmail = !currentRow.paidNotifiedAt;

    let history: PaymentHistoryEvent[] = [];
    try {
      history = currentRow.statusHistoryJson
        ? (JSON.parse(String(currentRow.statusHistoryJson)) as PaymentHistoryEvent[])
        : [];
    } catch {
      history = [];
    }

    if (history.length === 0) {
      history.push({
        status: "aguardando_pagamento",
        at: Number(currentRow.createdAt),
        by: "system",
      });
    }

    const last = history[history.length - 1];
    if (last?.status !== "pago") {
      history.push({ status: "pago", at: now, by: paidBy });
    }

    let payment: Record<string, unknown> | null = null;
    try {
      payment = currentRow.paymentJson
        ? (JSON.parse(String(currentRow.paymentJson)) as Record<string, unknown>)
        : null;
    } catch {
      payment = null;
    }

    if (payment) {
      payment.status = "paid";
      if (paymentPatch) {
        Object.assign(payment, paymentPatch);
      }
    }

    if (shouldDeductStock) {
      const items = currentRow.itemsJson
        ? (JSON.parse(String(currentRow.itemsJson)) as OrderItemSnapshot[])
        : [];

      for (const item of items) {
        if (!item.productId || !item.qty) continue;

        const deduction = db
          .prepare(
            `UPDATE products
             SET stock = stock - ?
             WHERE id = ? AND stock >= ?`,
          )
          .run(item.qty, item.productId, item.qty);

        if (deduction.changes !== 1) {
          throw new Error(`insufficient_stock:${item.productId}`);
        }
      }
    }

    db.prepare(
      `UPDATE orders
       SET status = ?,
           statusHistoryJson = ?,
           paymentJson = ?,
           stockDeductedAt = COALESCE(stockDeductedAt, ?)
       WHERE id = ?`,
    ).run(
      "pago",
      JSON.stringify(history),
      payment ? JSON.stringify(payment) : currentRow.paymentJson,
      shouldDeductStock ? now : null,
      String(currentRow.id),
    );

    return {
      alreadyProcessed: false as const,
      orderId: String(currentRow.id),
      shouldSendPaidEmail,
    };
  });

  return processPayment();
}
