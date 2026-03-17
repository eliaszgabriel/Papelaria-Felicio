import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateCsrfRequest } from "@/lib/csrf";
import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";

export const runtime = "nodejs";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV !== "production" ? "dev-secret-troque-isso" : "");

type SessionPayload = {
  sub: string | number;
};

async function getUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("pf_session")?.value;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, JWT_SECRET) as SessionPayload;
    return Number(payload.sub);
  } catch {
    return null;
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ productId: string }> },
) {
  const csrfError = validateCsrfRequest(req);
  if (csrfError) {
    return csrfError;
  }

  const userId = await getUserId();
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });

  const { productId } = await ctx.params;
  const pid = decodeURIComponent(productId || "").trim();

  if (!pid) {
    return NextResponse.json(
      { ok: false, error: "productId invalido" },
      { status: 400 },
    );
  }

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    await pool.query(
      `DELETE FROM wishlist_items WHERE user_id = $1 AND product_id = $2`,
      [userId, pid],
    );
  } else {
    const { db } = await import("@/lib/db");
    db.prepare("DELETE FROM wishlist_items WHERE user_id = ? AND product_id = ?").run(
      userId,
      pid,
    );
  }

  return NextResponse.json({ ok: true });
}
