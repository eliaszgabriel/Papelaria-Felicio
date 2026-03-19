import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateCsrfRequest } from "@/lib/csrf";
import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";
import { verifySessionToken } from "@/lib/sessionToken";

export const runtime = "nodejs";

async function getUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("pf_session")?.value;
  const payload = verifySessionToken(token);
  return payload ? Number(payload.sub) : null;
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
