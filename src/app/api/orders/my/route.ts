import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";
import { verifySessionToken } from "@/lib/sessionToken";


function safeParse<T = unknown>(v: unknown): T | null {
  if (!v) return null;
  try {
    return JSON.parse(String(v)) as T;
  } catch {
    return null;
  }
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("pf_session")?.value;

  if (!token) {
    return NextResponse.json(
      { ok: false, reason: "Nao autenticado." },
      { status: 401 },
    );
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    return NextResponse.json(
      { ok: false, reason: "Sessao invalida." },
      { status: 401 },
    );
  }

  const userId = Number(payload.sub);

  let rows: Array<Record<string, unknown>> = [];

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const result = await pool.query<Record<string, unknown>>(
      `SELECT
         id,
         createdat AS "createdAt",
         status,
         paymentmethod AS "paymentMethod",
         subtotal,
         shippingamount AS "shippingAmount",
         total,
         itemsjson AS "itemsJson",
         addressjson AS "addressJson"
       FROM orders
       WHERE user_id = $1
       ORDER BY createdat DESC`,
      [userId],
    );
    rows = result.rows;
  } else {
    const { db } = await import("@/lib/db");
    rows = db
      .prepare(`SELECT * FROM orders WHERE user_id = ? ORDER BY createdAt DESC`)
      .all(userId) as Array<Record<string, unknown>>;
  }

  const orders = rows.map((r) => ({
    id: r.id,
    createdAt: Number(r.createdAt),
    status: r.status,
    paymentMethod: r.paymentMethod,
    subtotal: Number(r.subtotal || 0),
    shippingAmount: Number(r.shippingAmount || 0),
    total: Number(r.total || 0),
    items: safeParse(r.itemsJson) || [],
    address: safeParse(r.addressJson) || null,
  }));

  return NextResponse.json({ ok: true, orders });
}
