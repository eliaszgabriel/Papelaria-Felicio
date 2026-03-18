import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { shippedTemplate } from "@/lib/emailTemplates";
import { isAdminSession } from "@/lib/adminAuth";
import { validateCsrfRequest } from "@/lib/csrf";
import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";
import { syncApprovedOrderToTiny } from "@/lib/tinyOrders";
import { markOrderPaid } from "@/lib/orderPayments";

export const runtime = "nodejs";

type OrderStatus = "aguardando_pagamento" | "pago" | "enviado";
type StatusEvent = { status: OrderStatus; at: number; by: "system" | "admin" };
type StatusBody = {
  status?: OrderStatus;
  trackingCode?: string;
  trackingCarrier?: string;
  trackingUrl?: string;
};
type UpdatedOrderRow = {
  id: string;
  status: string;
  total: number;
  customerEmail: string | null;
  trackingCode: string | null;
  trackingCarrier: string | null;
  trackingUrl: string | null;
  shippedNotifiedAt: number | null;
};

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const csrfError = validateCsrfRequest(req);
  if (csrfError) {
    return csrfError;
  }

  if (!(await isAdminSession())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { id } = await ctx.params;
  const orderId = decodeURIComponent(id);

  const body = (await req.json().catch(() => null)) as StatusBody | null;
  const status = body?.status as OrderStatus | undefined;

  const trackingCode = String(body?.trackingCode || "").trim();
  const trackingCarrier = String(body?.trackingCarrier || "").trim();
  const trackingUrl = String(body?.trackingUrl || "").trim();

  const allowed: OrderStatus[] = ["aguardando_pagamento", "pago", "enviado"];
  if (!status || !allowed.includes(status)) {
    return NextResponse.json(
      { ok: false, error: "status_invalido" },
      { status: 400 },
    );
  }

  let row:
    | { status: string; createdAt: number; statusHistoryJson?: string | null }
    | undefined;

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const result = await pool.query<{
      status: string;
      createdAt: number;
      statusHistoryJson?: string | null;
    }>(
      `SELECT
         status,
         createdat AS "createdAt",
         statushistoryjson AS "statusHistoryJson"
       FROM orders
       WHERE id = $1`,
      [orderId],
    );
    row = result.rows[0];
  } else {
    const { db } = await import("@/lib/db");
    row = db
      .prepare(
        `SELECT status, createdAt, statusHistoryJson FROM orders WHERE id = ?`,
      )
      .get(orderId) as
      | { status: string; createdAt: number; statusHistoryJson?: string | null }
      | undefined;
  }

  if (!row) {
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404 },
    );
  }

  const current = String(row.status);
  const canGoForward =
    (current === "aguardando_pagamento" && status === "pago") ||
    (current === "pago" && status === "enviado") ||
    current === status;

  if (!canGoForward) {
    return NextResponse.json(
      { ok: false, error: `invalid_transition:${current}->${status}` },
      { status: 400 },
    );
  }

  let history: StatusEvent[] = [];
  try {
    history = row.statusHistoryJson ? JSON.parse(row.statusHistoryJson) : [];
  } catch {
    history = [];
  }

  if (history.length === 0) {
    history.push({
      status: "aguardando_pagamento",
      at: row.createdAt,
      by: "system",
    });
  }

  const last = history[history.length - 1];
  if (last?.status !== status) {
    history.push({ status, at: Date.now(), by: "admin" });
  }

  if (status === "pago" && current === "aguardando_pagamento") {
    try {
      await markOrderPaid({
        orderId,
        paidBy: "admin",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "unknown_error";
      if (String(message).startsWith("insufficient_stock:")) {
        return NextResponse.json(
          { ok: false, error: "insufficient_stock_after_order" },
          { status: 409 },
        );
      }

      console.error("Falha ao marcar pedido como pago no admin:", error);
      return NextResponse.json(
        { ok: false, error: "payment_update_failed" },
        { status: 500 },
      );
    }
  } else if (trackingCode || trackingCarrier || trackingUrl) {
    if (hasPostgresConfig()) {
      const pool = getPostgresPool();
      await pool.query(
        `
        UPDATE orders
        SET status = $1,
            statushistoryjson = $2,
            trackingcode = NULLIF($3, ''),
            trackingcarrier = NULLIF($4, ''),
            trackingurl = NULLIF($5, '')
        WHERE id = $6
        `,
        [
          status,
          JSON.stringify(history),
          trackingCode,
          trackingCarrier,
          trackingUrl,
          orderId,
        ],
      );
    } else {
      const { db } = await import("@/lib/db");
      db.prepare(
        `
        UPDATE orders
        SET status = ?,
            statusHistoryJson = ?,
            trackingCode = NULLIF(?, ''),
            trackingCarrier = NULLIF(?, ''),
            trackingUrl = NULLIF(?, '')
        WHERE id = ?
        `,
      ).run(
        status,
        JSON.stringify(history),
        trackingCode,
        trackingCarrier,
        trackingUrl,
        orderId,
      );
    }
  } else {
    if (hasPostgresConfig()) {
      const pool = getPostgresPool();
      await pool.query(
        `
        UPDATE orders
        SET status = $1,
            statushistoryjson = $2
        WHERE id = $3
        `,
        [status, JSON.stringify(history), orderId],
      );
    } else {
      const { db } = await import("@/lib/db");
      db.prepare(
        `
        UPDATE orders
        SET status = ?,
            statusHistoryJson = ?
        WHERE id = ?
        `,
      ).run(status, JSON.stringify(history), orderId);
    }
  }

  let updated: UpdatedOrderRow | undefined;
  let tinySync:
    | { ok: true; skipped: true; reason: string; tinyOrderId?: string | number | null }
    | {
        ok: true;
        skipped: false;
        tinyOrderId: string | number;
        tinyOrderNumber?: string | number | null;
        approved: boolean;
      }
    | { ok: false; skipped: false; reason: string; message: string }
    | null = null;

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const result = await pool.query<UpdatedOrderRow>(
      `
      SELECT
        id,
        status,
        total,
        customeremail AS "customerEmail",
        trackingcode AS "trackingCode",
        trackingcarrier AS "trackingCarrier",
        trackingurl AS "trackingUrl",
        shippednotifiedat AS "shippedNotifiedAt"
      FROM orders
      WHERE id = $1
      LIMIT 1
      `,
      [orderId],
    );
    updated = result.rows[0];
  } else {
    const { db } = await import("@/lib/db");
    updated = db
      .prepare(
        `
        SELECT
          id,
          status,
          total,
          customerEmail,
          trackingCode,
          trackingCarrier,
          trackingUrl,
          shippedNotifiedAt
        FROM orders
        WHERE id = ?
        LIMIT 1
        `,
      )
      .get(orderId) as UpdatedOrderRow | undefined;
  }

  if (
    updated?.status === "pago"
  ) {
    tinySync = await syncApprovedOrderToTiny(String(updated.id)).catch((error) => {
      console.error("Erro ao sincronizar pedido aprovado no Tiny (admin):", error);
      return null;
    });

    if (tinySync?.ok && tinySync.skipped) {
      console.log("Sincronizacao Tiny pulada (admin):", tinySync.reason);
    }

    if (tinySync?.ok && !tinySync.skipped) {
      console.log("Pedido sincronizado com Tiny (admin):", {
        orderId: updated.id,
        tinyOrderId: tinySync.tinyOrderId,
        tinyOrderNumber: tinySync.tinyOrderNumber ?? null,
      });
    }

    if (tinySync && !tinySync.ok) {
      console.error("Falha de sincronizacao Tiny (admin):", tinySync.message);
    }
  }

  if (
    updated?.status === "enviado" &&
    updated.customerEmail?.trim() &&
    !updated.shippedNotifiedAt
  ) {
    const tpl = shippedTemplate({
      id: String(updated.id),
      total: Number(updated.total || 0),
      status: "enviado",
      customer: { email: updated.customerEmail.trim() },
      trackingCode: updated.trackingCode ?? null,
      trackingCarrier: updated.trackingCarrier ?? null,
      trackingUrl: updated.trackingUrl ?? null,
    });

    await sendEmail({
      to: updated.customerEmail.trim(),
      subject: tpl.subject,
      html: tpl.html,
    });

    if (hasPostgresConfig()) {
      const pool = getPostgresPool();
      await pool.query(`UPDATE orders SET shippednotifiedat = $1 WHERE id = $2`, [
        Date.now(),
        updated.id,
      ]);
    } else {
      const { db } = await import("@/lib/db");
      db.prepare(`UPDATE orders SET shippedNotifiedAt = ? WHERE id = ?`).run(
        Date.now(),
        updated.id,
      );
    }
  }

  return NextResponse.json({ ok: true, tinySync });
}
