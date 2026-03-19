import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { validateCsrfRequest } from "@/lib/csrf";
import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";
import { getJwtSecret } from "@/lib/runtimeSecrets";

export const runtime = "nodejs";

type SessionPayload = {
  sub: string | number;
};

type WishlistSyncBody = {
  productIds?: Array<string | number>;
};

async function getUserId(): Promise<number | null> {
  const jwtSecret = getJwtSecret();
  const cookieStore = await cookies();
  const token = cookieStore.get("pf_session")?.value;

  if (!token || !jwtSecret) {
    return null;
  }

  try {
    const payload = jwt.verify(token, jwtSecret) as SessionPayload;
    return Number(payload.sub);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const csrfError = validateCsrfRequest(req);
  if (csrfError) {
    return csrfError;
  }

  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as WishlistSyncBody | null;
  const ids = Array.isArray(body?.productIds)
    ? body.productIds.map(String).filter(Boolean).slice(0, 200)
    : [];

  if (!ids.length) {
    return NextResponse.json({ ok: true, synced: 0 });
  }

  const now = Date.now();
  let inserted = 0;

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    for (const productId of ids) {
      const result = await pool.query(
        `INSERT INTO wishlist_items (user_id, product_id, "createdAt")
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, product_id) DO NOTHING`,
        [userId, productId, now],
      );
      if (result.rowCount) {
        inserted += 1;
      }
    }
  } else {
    const { db } = await import("@/lib/db");
    const stmt = db.prepare(
      "INSERT OR IGNORE INTO wishlist_items (user_id, product_id, createdAt) VALUES (?, ?, ?)",
    );
    const tx = db.transaction(() => {
      for (const productId of ids) {
        const result = stmt.run(userId, productId, now);
        if (result.changes) {
          inserted += 1;
        }
      }
    });
    tx();
  }

  return NextResponse.json({ ok: true, synced: inserted });
}
