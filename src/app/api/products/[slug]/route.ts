import { NextResponse } from "next/server";
import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";

export const runtime = "nodejs";

type ProductRow = {
  id: string | number;
  slug: string;
  name: string;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  featured: number;
  deal: number;
  isCollection?: number;
  isWeeklyFavorite?: number;
  stock: number;
  active: number;
};

type ProductImageRow = {
  id: string | number;
  url: string;
  alt: string | null;
  sortOrder: number;
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const s = decodeURIComponent(slug);

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const productResult = await pool.query<ProductRow>(
      `SELECT
         id,
         slug,
         name,
         description,
         price,
         compareatprice AS "compareAtPrice",
         featured,
         deal,
         iscollection AS "isCollection",
         isweeklyfavorite AS "isWeeklyFavorite",
         stock,
         active
       FROM products
       WHERE slug = $1 AND active = 1
       LIMIT 1`,
      [s],
    );

    const product = productResult.rows[0];

    if (!product) {
      return NextResponse.json(
        { ok: false, error: "not_found" },
        { status: 404 },
      );
    }

    const imagesResult = await pool.query<ProductImageRow>(
      `SELECT id, url, alt, sortorder AS "sortOrder"
       FROM product_images
       WHERE productid = $1
       ORDER BY sortorder ASC`,
      [product.id],
    );

    return NextResponse.json({
      ok: true,
      product: { ...product, images: imagesResult.rows },
    });
  }

  const { db } = await import("@/lib/db");
  const product = db
    .prepare(`SELECT * FROM products WHERE slug = ? AND active = 1 LIMIT 1`)
    .get(s) as ProductRow | undefined;

  if (!product) {
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404 },
    );
  }

  const images = db
    .prepare(
      `SELECT id, url, alt, sortOrder FROM product_images WHERE productId = ? ORDER BY sortOrder ASC`,
    )
    .all(product.id) as ProductImageRow[];

  return NextResponse.json({ ok: true, product: { ...product, images } });
}
