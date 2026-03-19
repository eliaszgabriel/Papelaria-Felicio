import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateCsrfRequest } from "@/lib/csrf";
import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";
import { verifySessionToken } from "@/lib/sessionToken";

export const runtime = "nodejs";

type WishlistRow = {
  product_id: number;
  id: number;
  slug: string;
  name: string;
  price: number;
  stock: number;
  active: number;
  coverImage: string | null;
};

type WishlistPostBody = {
  productId?: string | number;
};

async function getUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("pf_session")?.value;
  const payload = verifySessionToken(token);
  return payload ? Number(payload.sub) : null;
}

export async function GET(req: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");

  if (productId) {
    let exists: unknown;

    if (hasPostgresConfig()) {
      const pool = getPostgresPool();
      const result = await pool.query(
        `SELECT 1 FROM wishlist_items WHERE user_id = $1 AND product_id = $2 LIMIT 1`,
        [userId, productId],
      );
      exists = result.rows[0];
    } else {
      const { db } = await import("@/lib/db");
      exists = db
        .prepare(
          "SELECT 1 FROM wishlist_items WHERE user_id = ? AND product_id = ? LIMIT 1",
        )
        .get(userId, productId);
    }

    return NextResponse.json({ ok: true, contains: Boolean(exists) });
  }

  let rows: WishlistRow[] = [];

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const result = await pool.query<WishlistRow>(
      `SELECT w.product_id, p.id, p.slug, p.name, p.price, p.stock, p.active,
              (
                SELECT url
                FROM product_images
                WHERE productid = p.id
                ORDER BY sortorder ASC
                LIMIT 1
              ) AS "coverImage"
       FROM wishlist_items w
       JOIN products p ON p.id = w.product_id
       WHERE w.user_id = $1
       ORDER BY w.createdat DESC`,
      [userId],
    );
    rows = result.rows;
  } else {
    const { db } = await import("@/lib/db");
    rows = db
      .prepare(
        `SELECT w.product_id, p.id, p.slug, p.name, p.price, p.stock, p.active,
                (SELECT url FROM product_images WHERE productId = p.id ORDER BY sortOrder ASC LIMIT 1) AS coverImage
         FROM wishlist_items w
         JOIN products p ON p.id = w.product_id
         WHERE w.user_id = ?
         ORDER BY w.createdAt DESC`,
      )
      .all(userId) as WishlistRow[];
  }

  return NextResponse.json({ ok: true, items: rows });
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

  const body = (await req.json().catch(() => null)) as WishlistPostBody | null;
  const productId = String(body?.productId || "").trim();

  if (!productId) {
    return NextResponse.json(
      { ok: false, error: "productId obrigatorio" },
      { status: 400 },
    );
  }

  try {
    if (hasPostgresConfig()) {
      const pool = getPostgresPool();
      await pool.query(
        `INSERT INTO wishlist_items (user_id, product_id, createdat)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, product_id) DO NOTHING`,
        [userId, productId, Date.now()],
      );
    } else {
      const { db } = await import("@/lib/db");
      db.prepare(
        "INSERT OR IGNORE INTO wishlist_items (user_id, product_id, createdAt) VALUES (?, ?, ?)",
      ).run(userId, productId, Date.now());
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao salvar wishlist";

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
