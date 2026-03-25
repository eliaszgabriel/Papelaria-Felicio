import { cache } from "react";
import { CATEGORY_NAME_BY_ID, DEFAULT_CATEGORIES } from "@/lib/catalog";
import { ensureDefaultCategories } from "@/lib/categories";
import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";
import { parseProductColorOptionsJson } from "@/lib/productColorOptions";

type CategoryRow = {
  id: string;
  name: string;
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
  images?: Array<{ url?: string | null }> | null;
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

type ProductImageRow = {
  id: string | number;
  url: string;
  alt: string | null;
  sortOrder: number;
};

type ProductRow = {
  id: string | number;
  slug: string;
  name: string;
  shortDescription: string | null;
  colorOptionsJson?: string | null;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  featured: number;
  deal: number;
  isCollection?: number;
  isWeeklyFavorite?: number;
  stock: number;
  active: number;
  coverImage?: string | null;
};

type ProductCountRow = {
  categoryId: string;
  total: number | string;
};

export type StorefrontCategory = {
  id: string;
  name: string;
};

export type StorefrontProductListItem = ProductListRow;

export type StorefrontProduct = ProductRow & {
  images: ProductImageRow[];
  colorOptions: ReturnType<typeof parseProductColorOptionsJson>;
};

export type StorefrontProductFilters = {
  category?: string;
  featured?: string;
  deal?: string;
  movingShowcase?: string;
  subCategory?: string;
  color?: string;
  sort?: string;
  q?: string;
  limit?: number;
  offset?: number;
};

export function parseStorefrontProductQuery(query?: string): StorefrontProductFilters {
  const searchParams = new URLSearchParams(query || "");

  const limitValue = searchParams.get("limit");
  const offsetValue = searchParams.get("offset");
  const limit =
    limitValue && Number.isFinite(Number(limitValue))
      ? Number(limitValue)
      : undefined;
  const offset =
    offsetValue && Number.isFinite(Number(offsetValue))
      ? Number(offsetValue)
      : undefined;

  return {
    category: searchParams.get("category") || undefined,
    featured: searchParams.get("featured") || undefined,
    deal: searchParams.get("deal") || undefined,
    movingShowcase: searchParams.get("movingShowcase") || undefined,
    subCategory: searchParams.get("subCategory") || undefined,
    color: searchParams.get("color") || undefined,
    sort: searchParams.get("sort") || undefined,
    q: searchParams.get("q") || undefined,
    limit,
    offset,
  };
}

function buildProductFilters({
  category,
  featured,
  deal,
  movingShowcase,
  subCategory,
  color,
  q,
}: StorefrontProductFilters) {
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
    where.push("LOWER(p.name) LIKE ?");
    params.push(`%${q.toLowerCase()}%`);
  }

  return { where, params };
}

function buildPgProductFilters(filters: StorefrontProductFilters) {
  const where: string[] = ["p.active = 1"];
  const params: Array<string | number> = [];
  let paramIndex = 1;

  if (filters.category) {
    where.push(
      `(p.categoryid = $${paramIndex} OR EXISTS (
        SELECT 1
        FROM product_category_links pcl
        WHERE pcl.productid = p.id AND pcl.categoryid = $${paramIndex + 1}
      ))`,
    );
    params.push(filters.category, filters.category);
    paramIndex += 2;
  }
  if (filters.featured === "1") where.push("p.featured = 1");
  if (filters.deal === "1") where.push("p.deal = 1");
  if (filters.movingShowcase === "1") where.push("p.inmovingshowcase = 1");
  if (filters.subCategory) {
    where.push(`p.subcategoryid = $${paramIndex}`);
    params.push(filters.subCategory);
    paramIndex += 1;
  }
  if (filters.color) {
    where.push(`LOWER(COALESCE(p.color, '')) = $${paramIndex}`);
    params.push(filters.color.toLowerCase());
    paramIndex += 1;
  }
  if (filters.q) {
    where.push(`LOWER(p.name) LIKE $${paramIndex}`);
    params.push(`%${filters.q.toLowerCase()}%`);
    paramIndex += 1;
  }

  return { where, params, nextParamIndex: paramIndex };
}

function getOrderBy(sort?: string) {
  if (sort === "price_asc") {
    return {
      sqlite: "p.price ASC",
      postgres: "p.price ASC",
    };
  }

  if (sort === "price_desc") {
    return {
      sqlite: "p.price DESC",
      postgres: "p.price DESC",
    };
  }

  return {
    sqlite: "p.createdAt DESC",
    postgres: "p.createdat DESC",
  };
}

export const getStorefrontCategories = cache(async (): Promise<
  StorefrontCategory[]
> => {
  await ensureDefaultCategories();

  let rows: CategoryRow[] = [];

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const result = await pool.query<CategoryRow>(
      `SELECT id, name FROM categories WHERE active = 1 ORDER BY sortorder ASC, name ASC`,
    );
    rows = result.rows;
  } else {
    const { db } = await import("@/lib/db");
    rows = db
      .prepare(
        `SELECT id, name FROM categories WHERE active = 1 ORDER BY sortOrder ASC, name ASC`,
      )
      .all() as CategoryRow[];
  }

  const sortOrder = new Map<string, number>(
    DEFAULT_CATEGORIES.map((category, index) => [String(category.id), index]),
  );

  rows.sort((a, b) => {
    const left = sortOrder.get(a.id) ?? 999;
    const right = sortOrder.get(b.id) ?? 999;
    if (left !== right) return left - right;
    return a.name.localeCompare(b.name, "pt-BR");
  });

  return rows.map((row) => ({
    id: row.id,
    name: CATEGORY_NAME_BY_ID[row.id] ?? row.name,
  }));
});

export async function getStorefrontProducts(filters: StorefrontProductFilters) {
  const limit =
    typeof filters.limit === "number" && Number.isFinite(filters.limit)
      ? Math.min(Math.max(filters.limit, 0), 60)
      : 0;
  const offset =
    typeof filters.offset === "number" && Number.isFinite(filters.offset)
      ? Math.max(filters.offset, 0)
      : 0;
  const orderBy = getOrderBy(filters.sort);

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const { where, params, nextParamIndex } = buildPgProductFilters(filters);
    const whereSql = `WHERE ${where.join(" AND ")}`;

    const totalResult = await pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM products p ${whereSql}`,
      params,
    );
    const total = Number(totalResult.rows[0]?.total || 0);

    const limitSql =
      limit > 0 ? `LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1}` : "";
    const listParams = limit > 0 ? [...params, limit, offset] : params;

    const rowsResult = await pool.query<ProductListRow>(
      `
      SELECT
        p.id,
        p.slug,
        p.name,
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
      ${whereSql}
      ORDER BY ${orderBy.postgres}
      ${limitSql}
      `,
      listParams,
    );

    return { items: rowsResult.rows, total };
  }

  const { db } = await import("@/lib/db");
  const { where, params } = buildProductFilters(filters);
  const whereSql = `WHERE ${where.join(" AND ")}`;

  const totalRow = db
    .prepare(
      `
      SELECT COUNT(*) as total
      FROM products p
      ${whereSql}
      `,
    )
    .get(...params) as { total?: number } | undefined;

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
      ORDER BY ${orderBy.sqlite}
      ${limitSql}
      `,
    )
    .all(...listParams) as ProductListRow[];

  return { items: rows, total };
}

export async function getStorefrontCategoryCounts(filters: {
  q?: string;
  deal?: string;
}) {
  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const { where, params } = buildPgProductFilters({
      q: filters.q,
      deal: filters.deal,
    });
    const whereSql = `WHERE ${where.join(" AND ")}`;

    const result = await pool.query<ProductCountRow>(
      `
      SELECT "categoryId", COUNT(DISTINCT "productId")::int AS total
      FROM (
        SELECT p.id AS "productId", p.categoryid AS "categoryId"
        FROM products p
        ${whereSql}
        AND COALESCE(p.categoryid, '') <> ''

        UNION ALL

        SELECT p.id AS "productId", pcl.categoryid AS "categoryId"
        FROM products p
        INNER JOIN product_category_links pcl
          ON pcl.productid = p.id
        ${whereSql}
      ) category_products
      GROUP BY "categoryId"
      `,
      [...params, ...params],
    );

    return new Map(
      result.rows.map((row) => [row.categoryId, Number(row.total || 0)]),
    );
  }

  const { db } = await import("@/lib/db");
  const { where, params } = buildProductFilters({
    q: filters.q,
    deal: filters.deal,
  });
  const whereSql = `WHERE ${where.join(" AND ")}`;

  const rows = db
    .prepare(
      `
      SELECT categoryId, COUNT(DISTINCT productId) AS total
      FROM (
        SELECT p.id AS productId, p.categoryId AS categoryId
        FROM products p
        ${whereSql}
        AND COALESCE(p.categoryId, '') <> ''

        UNION ALL

        SELECT p.id AS productId, pcl.categoryId AS categoryId
        FROM products p
        INNER JOIN product_category_links pcl
          ON pcl.productId = p.id
        ${whereSql}
      ) category_products
      GROUP BY categoryId
      `,
    )
    .all(...params, ...params) as ProductCountRow[];

  return new Map(
    rows.map((row) => [row.categoryId, Number(row.total || 0)]),
  );
}

export const getStorefrontProductBySlug = cache(
  async (slug: string): Promise<StorefrontProduct | null> => {
    const normalizedSlug = decodeURIComponent(slug);

    if (hasPostgresConfig()) {
      const pool = getPostgresPool();
      const productResult = await pool.query<ProductRow>(
        `SELECT
           id,
           slug,
           name,
           shortdescription AS "shortDescription",
           coloroptionsjson AS "colorOptionsJson",
           description,
           price,
           compareatprice AS "compareAtPrice",
           featured,
           deal,
           iscollection AS "isCollection",
           isweeklyfavorite AS "isWeeklyFavorite",
           stock,
           active,
           (
             SELECT url
             FROM product_images i
             WHERE i.productid = products.id
             ORDER BY i.sortorder ASC
             LIMIT 1
           ) AS "coverImage"
         FROM products
         WHERE slug = $1 AND active = 1
         LIMIT 1`,
        [normalizedSlug],
      );

      const product = productResult.rows[0];
      if (!product) return null;

      const imagesResult = await pool.query<ProductImageRow>(
        `SELECT id, url, alt, sortorder AS "sortOrder"
         FROM product_images
         WHERE productid = $1
         ORDER BY sortorder ASC`,
        [product.id],
      );

      return {
        ...product,
        images: imagesResult.rows,
        colorOptions: parseProductColorOptionsJson(product.colorOptionsJson),
      };
    }

    const { db } = await import("@/lib/db");
    const product = db
      .prepare(
        `SELECT
          p.*,
          (SELECT url FROM product_images i WHERE i.productId = p.id ORDER BY i.sortOrder ASC LIMIT 1) AS coverImage
        FROM products p
        WHERE slug = ? AND active = 1
        LIMIT 1`,
      )
      .get(normalizedSlug) as ProductRow | undefined;

    if (!product) return null;

    const images = db
      .prepare(
        `SELECT id, url, alt, sortOrder FROM product_images WHERE productId = ? ORDER BY sortOrder ASC`,
      )
      .all(product.id) as ProductImageRow[];

    return {
      ...product,
      images,
      colorOptions: parseProductColorOptionsJson(product.colorOptionsJson),
    };
  },
);
