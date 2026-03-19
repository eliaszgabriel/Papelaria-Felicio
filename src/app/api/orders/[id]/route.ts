import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { verifyOrderLookupToken } from "@/lib/orderAccess";
import { isAdminSession } from "@/lib/adminAuth";
import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";
import { getJwtSecret } from "@/lib/runtimeSecrets";

export const runtime = "nodejs";


type OrderRow = Record<string, unknown> & {
  customerJson: string;
  addressJson?: string | null;
  itemsJson: string;
  paymentJson?: string | null;
  statusHistoryJson?: string | null;
  user_id?: number | null;
};

function safeParse<T = unknown>(value: unknown): T | undefined {
  if (value == null || value === "") return undefined;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return undefined;
  }
}

function rowToOrder(row: OrderRow) {
  const payment = safeParse<Record<string, unknown>>(row.paymentJson);
  const invoicePayload =
    payment && typeof payment.invoice === "object" && payment.invoice
      ? (payment.invoice as Record<string, unknown>)
      : null;
  const statusHistory = safeParse<
    Array<{ status?: string; at?: string | number; by?: string }>
  >(row.statusHistoryJson)?.map((entry) => ({
    status: String(entry?.status || "aguardando_pagamento"),
    at: Number(entry?.at || 0),
    by: String(entry?.by || "system"),
  }));

  return {
    id: row.id,
    createdAt: Number(row.createdAt || 0),
    status: row.status,
    paymentMethod: row.paymentMethod,
    payment,
    customer: safeParse(row.customerJson) ?? {},
    address: safeParse(row.addressJson),
    items: safeParse(row.itemsJson) ?? [],
    subtotal: Number(row.subtotal || 0),
    shippingAmount: Number(row.shippingAmount || 0),
    total: Number(row.total || 0),
    trackingCode: row.trackingCode ?? undefined,
    trackingCarrier: row.trackingCarrier ?? undefined,
    trackingUrl: row.trackingUrl ?? undefined,
    invoice: invoicePayload?.url
      ? {
          url: String(invoicePayload.url),
          filename: String(invoicePayload.filename || "nota-fiscal.pdf"),
          uploadedAt: invoicePayload.uploadedAt
            ? Number(invoicePayload.uploadedAt)
            : null,
          sentAt: invoicePayload.sentAt ? Number(invoicePayload.sentAt) : null,
        }
      : null,
    statusHistory,
  };
}

async function getSessionUserId() {
  try {
    const jwtSecret = getJwtSecret();
    if (!jwtSecret) return null;
    const cookieStore = await cookies();
    const token = cookieStore.get("pf_session")?.value;
    if (!token) return null;
    const payload = jwt.verify(token, jwtSecret) as { sub?: string | number };
    return Number(payload.sub);
  } catch {
    return null;
  }
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const orderId = decodeURIComponent(id);

  let row: OrderRow | undefined;

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const result = await pool.query<OrderRow>(
      `SELECT
         id,
         createdat AS "createdAt",
         status,
         paymentmethod AS "paymentMethod",
         paymentjson AS "paymentJson",
         customerjson AS "customerJson",
         addressjson AS "addressJson",
         itemsjson AS "itemsJson",
         subtotal,
         shippingamount AS "shippingAmount",
         total,
         trackingcode AS "trackingCode",
         trackingcarrier AS "trackingCarrier",
         trackingurl AS "trackingUrl",
         statushistoryjson AS "statusHistoryJson",
         user_id
       FROM orders
       WHERE id = $1
       LIMIT 1`,
      [orderId],
    );
    row = result.rows[0];
  } else {
    const { db } = await import("@/lib/db");
    row = db
      .prepare(`SELECT * FROM orders WHERE id = ?`)
      .get(orderId) as OrderRow | undefined;
  }

  if (!row) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const sessionUserId = await getSessionUserId();
  const orderUserId = Number(row.user_id ?? 0) || null;
  const cookieStore = await cookies();
  const accessToken =
    new URL(req.url).searchParams.get("access") ||
    cookieStore.get("pf_order_lookup")?.value ||
    null;

  let authorized = false;

  if (await isAdminSession()) {
    authorized = true;
  }

  if (!authorized && sessionUserId && orderUserId && sessionUserId === orderUserId) {
    authorized = true;
  }

  if (!authorized) {
    const lookup = verifyOrderLookupToken(accessToken);
    if (lookup?.email) {
      try {
        const customer = JSON.parse(row.customerJson ?? "{}");
        if (
          customer.email &&
          String(customer.email).trim().toLowerCase() === lookup.email
        ) {
          authorized = true;
        }
      } catch {}
    }
  }

  if (!authorized) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({ ok: true, order: rowToOrder(row) });
}
