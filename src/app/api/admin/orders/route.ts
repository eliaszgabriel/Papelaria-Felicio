import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/adminAuth";
import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";

export const runtime = "nodejs";

type OrderRow = {
  id: string;
  createdAt: number;
  status: string;
  total: number;
  paymentMethod: string | null;
  customerJson: string;
};

type CustomerSummary = {
  name?: string;
  whats?: string;
};

type AdminOrder = {
  id: string;
  createdAt: number;
  status: string;
  total: number;
  paymentMethod: string | null;
  customer: CustomerSummary | null;
};

export async function GET(req: Request) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const status = (url.searchParams.get("status") || "").trim();

  let rows: OrderRow[] = [];

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const result = await pool.query<OrderRow>(
      `SELECT
         id,
         createdat AS "createdAt",
         status,
         total,
         paymentmethod AS "paymentMethod",
         customerjson AS "customerJson"
       FROM orders
       ORDER BY createdat DESC
       LIMIT 300`,
    );
    rows = result.rows;
  } else {
    const { db } = await import("@/lib/db");
    rows = db
      .prepare("SELECT * FROM orders ORDER BY createdAt DESC LIMIT 300")
      .all() as OrderRow[];
  }

  let orders: AdminOrder[] = rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    status: row.status,
    total: row.total,
    paymentMethod: row.paymentMethod,
    customer: JSON.parse(row.customerJson) as CustomerSummary,
  }));

  if (
    status &&
    ["aguardando_pagamento", "pago", "enviado", "cancelado"].includes(status)
  ) {
    orders = orders.filter((order) => order.status === status);
  }

  if (q) {
    orders = orders.filter((order) => {
      const name = String(order.customer?.name || "").toLowerCase();
      const whats = String(order.customer?.whats || "").toLowerCase();
      const id = String(order.id || "").toLowerCase();
      return id.includes(q) || name.includes(q) || whats.includes(q);
    });
  }

  return NextResponse.json({ ok: true, orders });
}
