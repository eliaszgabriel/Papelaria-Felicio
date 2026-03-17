import { NextResponse } from "next/server";
import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";

export const runtime = "nodejs";

type ProductQueryRow = {
  total?: number;
};

type ProductListRow = {
  id: string | number;
  slug: string;
  name: string;
  price: number;
  compareAtPrice?: number | null;
  categoryId?: string | number | null;
  subCategoryId?: string | null;
  color?: string | null;
  inMovingShowcase?: number;
  active?: number;
  featured?: number;
  deal?: number;
  isCollection?: number;
  isWeeklyFavorite?: number;
  stock?: number | null;
  createdAt?: number;
  coverImage?: string | null;
};

export async function GET(req: Request) {
  const url = new URL(req.url);

  const category = url.searchParams.get("category"); // categoryId
  const featured = url.searchParams.get("featured"); // "1"
  const deal = url.searchParams.get("deal"); // "1"
  const movingShowcase = url.searchParams.get("movingShowcase"); // "1"
  const subCategory = (url.searchParams.get("subCategory") || "").trim();
  const color = (url.searchParams.get("color") || "").trim();
  const sort = url.searchParams.get("sort") || "new"; // new|price_asc|price_desc
  const q = (url.searchParams.get("q") || "").trim();

  const limitRaw = url.searchParams.get("limit");
  const offsetRaw = url.searchParams.get("offset");

  const limit =
    limitRaw && Number.isFinite(Number(limitRaw))
      ? Math.min(Number(limitRaw), 60)
      : 0; // 0 = sem limit
  const offset =
    offsetRaw && Number.isFinite(Number(offsetRaw))
      ? Math.max(Number(offsetRaw), 0)
      : 0;

  const where: string[] = ["p.active = 1"];
  const params: Array<string | number> = [];

  if (category) {
    where.push(
      `(p.categoryId = ? OR EXISTS (
        SELECT 1
        FROM product_category_links pcl
        WHERE pcl.productId = p.id AND pcl.categoryId = ?
      ))`,
    );
    params.push(category, category);
  }
  if (featured === "1") where.push("p.featured = 1");
  if (deal === "1") where.push("p.deal = 1");
  if (movingShowcase === "1") where.push("p.inMovingShowcase = 1");
  if (subCategory) {
    where.push("p.subCategoryId = ?");
    params.push(subCategory);
  }
  if (color) {
    where.push("LOWER(COALESCE(p.color, '')) = ?");
    params.push(color.toLowerCase());
  }

  if (q) {
    // busca simples por nome (pode expandir depois para descrição)
    where.push("LOWER(p.name) LIKE ?");
    params.push(`%${q.toLowerCase()}%`);
  }

  let orderBy = "p.createdAt DESC";
  if (sort === "price_asc") orderBy = "p.price ASC";
  if (sort === "price_desc") orderBy = "p.price DESC";
  let orderByPg = "p.createdat DESC";
  if (sort === "price_asc") orderByPg = "p.price ASC";
  if (sort === "price_desc") orderByPg = "p.price DESC";

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // total (para paginação)
  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const pgWhereParts: string[] = ["p.active = 1"];
    const pgParams: Array<string | number> = [];
    let paramIndex = 1;

    if (category) {
      pgWhereParts.push(
        `(p.categoryid = $${paramIndex} OR EXISTS (
          SELECT 1
          FROM product_category_links pcl
          WHERE pcl.productid = p.id AND pcl.categoryid = $${paramIndex + 1}
        ))`,
      );
      pgParams.push(category, category);
      paramIndex += 2;
    }
    if (featured === "1") pgWhereParts.push('p.featured = 1');
    if (deal === "1") pgWhereParts.push('p.deal = 1');
    if (movingShowcase === "1") pgWhereParts.push("p.inmovingshowcase = 1");
    if (subCategory) {
      pgWhereParts.push(`p.subcategoryid = $${paramIndex}`);
      pgParams.push(subCategory);
      paramIndex += 1;
    }
    if (color) {
      pgWhereParts.push(`LOWER(COALESCE(p.color, '')) = $${paramIndex}`);
      pgParams.push(color.toLowerCase());
      paramIndex += 1;
    }
    if (q) {
      pgWhereParts.push(`LOWER(p.name) LIKE $${paramIndex}`);
      pgParams.push(`%${q.toLowerCase()}%`);
      paramIndex += 1;
    }

    const pgWhereSql = `WHERE ${pgWhereParts.join(" AND ")}`;
    const totalResult = await pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM products p ${pgWhereSql}`,
      pgParams,
    );
    const total = Number(totalResult.rows[0]?.total || 0);

    const limitSql =
      limit > 0
        ? `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
        : "";
    const listParams = limit > 0 ? [...pgParams, limit, offset] : pgParams;

    const rowsResult = await pool.query<ProductListRow>(
      `
      SELECT
        p.id,
        p.slug,
        p.name,
        p.description,
        p.price,
        p.compareatprice AS "compareAtPrice",
        p.categoryid AS "categoryId",
        p.subcategoryid AS "subCategoryId",
        p.color,
        p.inmovingshowcase AS "inMovingShowcase",
        p.active,
        p.featured,
        p.deal,
        p.iscollection AS "isCollection",
        p.isweeklyfavorite AS "isWeeklyFavorite",
        p.stock,
        p.createdat AS "createdAt",
        (
          SELECT url
          FROM product_images i
          WHERE i.productid = p.id
          ORDER BY i.sortorder ASC
          LIMIT 1
        ) AS "coverImage"
      FROM products p
      ${pgWhereSql}
      ORDER BY ${orderByPg}
      ${limitSql}
      `,
      listParams,
    );

    return NextResponse.json({ ok: true, total, items: rowsResult.rows });
  }

  const { db } = await import("@/lib/db");
  const totalRow = db
    .prepare(
      `
      SELECT COUNT(*) as total
      FROM products p
      ${whereSql}
      `,
    )
    .get(...params) as ProductQueryRow | undefined;

  const total = Number(totalRow?.total || 0);

  const limitSql = limit > 0 ? "LIMIT ? OFFSET ?" : "";
  const listParams = limit > 0 ? [...params, limit, offset] : params;

  const rows = db
    .prepare(
      `
      SELECT p.*,
        (SELECT url FROM product_images i WHERE i.productId = p.id ORDER BY sortOrder ASC LIMIT 1) AS coverImage
      FROM products p
      ${whereSql}
      ORDER BY ${orderBy}
      ${limitSql}
      `,
    )
    .all(...listParams) as ProductListRow[];

  return NextResponse.json({ ok: true, total, items: rows });
}
