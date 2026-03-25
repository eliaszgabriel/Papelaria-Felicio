import crypto from "crypto";
import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/adminAuth";
import { normalizeCategoryIds, normalizeTextValue } from "@/lib/catalog";
import { validateCsrfRequest } from "@/lib/csrf";
import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";
import {
  mergeProductImagesWithColorOptions,
  parseProductColorOptionsJson,
  serializeProductColorOptions,
  type ProductColorOption,
} from "@/lib/productColorOptions";

export const runtime = "nodejs";

type ProductQuickView = "all" | "olist" | "missingPhoto" | "syncing" | "outOfStock";

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  colorOptionsJson?: string | null;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  sku: string | null;
  active: number;
  categoryId: string | null;
  subCategoryId?: string | null;
  color?: string | null;
  inMovingShowcase?: number;
  featured: number;
  deal: number;
  isCollection?: number;
  isWeeklyFavorite?: number;
  externalSource?: string | null;
  externalSku?: string | null;
  syncStock?: number;
  syncPrice?: number;
  lastSyncedAt?: number | null;
  createdAt: number;
  updatedAt: number;
};

type ProductImageRow = {
  id: string;
  url: string;
  alt: string | null;
  sortOrder: number;
};

type ProductListRow = ProductRow & {
  categoryNames: string | null;
  coverImage: string | null;
  imageCount: number;
};

type ProductStatsRow = {
  total: number;
  onCount: number;
  offCount: number;
  olistCount: number;
  missingPhotoCount: number;
  syncingCount: number;
  outOfStockCount: number;
};

type ProductBodyImage = {
  url?: string;
  alt?: string | null;
  sortOrder?: number;
};

type ProductBody = {
  id?: string;
  name?: string;
  slug?: string;
  shortDescription?: string | null;
  description?: string | null;
  price?: number | string;
  compareAtPrice?: number | string | null;
  stock?: number | string;
  sku?: string | null;
  active?: number | string;
  categoryId?: string | null;
  categoryIds?: string[];
  subCategoryId?: string | null;
  color?: string | null;
  inMovingShowcase?: number | string;
  featured?: number | string;
  deal?: number | string;
  isCollection?: number | string;
  isWeeklyFavorite?: number | string;
  externalSource?: string | null;
  externalSku?: string | null;
  syncStock?: number | string | boolean;
  syncPrice?: number | string | boolean;
  lastSyncedAt?: number | null;
  images?: ProductBodyImage[];
  colorOptions?: ProductColorOption[];
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

export async function GET(req: Request) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const active = url.searchParams.get("active");
  const quickView = (url.searchParams.get("quickView") || "all") as ProductQuickView;
  const id = url.searchParams.get("id");
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("pageSize") || 50)),
  );

  if (id) {
    let product: ProductRow | undefined;

    if (hasPostgresConfig()) {
      const pool = getPostgresPool();
      const result = await pool.query<ProductRow>(
        `SELECT
           id,
           slug,
           name,
           shortdescription AS "shortDescription",
           coloroptionsjson AS "colorOptionsJson",
           description,
           price,
           compareatprice AS "compareAtPrice",
           stock,
           sku,
           active,
           categoryid AS "categoryId",
           subcategoryid AS "subCategoryId",
           color,
           inmovingshowcase AS "inMovingShowcase",
           featured,
           deal,
           iscollection AS "isCollection",
           isweeklyfavorite AS "isWeeklyFavorite",
           externalsource AS "externalSource",
           externalsku AS "externalSku",
           syncstock AS "syncStock",
           syncprice AS "syncPrice",
           lastsyncedat AS "lastSyncedAt",
           createdat AS "createdAt",
           updatedat AS "updatedAt"
         FROM products
         WHERE id = $1
         LIMIT 1`,
        [id],
      );
      product = result.rows[0];
    } else {
      const { db } = await import("@/lib/db");
      product = db
        .prepare("SELECT * FROM products WHERE id = ? LIMIT 1")
        .get(id) as ProductRow | undefined;
    }

    if (!product) {
      return NextResponse.json(
        { ok: false, error: "not_found" },
        { status: 404 },
      );
    }

    let images: ProductImageRow[] = [];
    let categoryIds: Array<{ categoryId: string }> = [];

    if (hasPostgresConfig()) {
      const pool = getPostgresPool();
      const [imagesResult, categoriesResult] = await Promise.all([
        pool.query<ProductImageRow>(
          `SELECT id, url, alt, sortorder as "sortOrder"
           FROM product_images
           WHERE productid = $1
           ORDER BY sortorder ASC`,
          [product.id],
        ),
        pool.query<{ categoryId: string }>(
          `SELECT categoryid as "categoryId"
           FROM product_category_links
           WHERE productid = $1
           ORDER BY createdat ASC`,
          [product.id],
        ),
      ]);
      images = imagesResult.rows;
      categoryIds = categoriesResult.rows;
    } else {
      const { db } = await import("@/lib/db");
      images = db
        .prepare(
          "SELECT id, url, alt, sortOrder FROM product_images WHERE productId = ? ORDER BY sortOrder ASC",
        )
        .all(product.id) as ProductImageRow[];

      categoryIds = db
        .prepare(
          "SELECT categoryId FROM product_category_links WHERE productId = ? ORDER BY createdAt ASC",
        )
        .all(product.id) as Array<{ categoryId: string }>;
    }

    return NextResponse.json({
      ok: true,
      product: {
        ...product,
        images,
        colorOptions: parseProductColorOptionsJson(product.colorOptionsJson),
        categoryIds: categoryIds.map((row) => row.categoryId),
      },
    });
  }

  const where: string[] = [];
  const params: Array<string | number> = [];

  if (q) {
    where.push("(lower(p.name) LIKE ? OR lower(p.slug) LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }

  if (active === "1" || active === "0") {
    where.push("p.active = ?");
    params.push(Number(active));
  }

  if (quickView === "olist") {
    where.push("p.externalSource = ?");
    params.push("olist");
  }
  if (quickView === "missingPhoto") {
    where.push(
      `(SELECT COUNT(1) FROM product_images i WHERE i.productId = p.id) = 0`,
    );
  }
  if (quickView === "syncing") {
    where.push("(p.syncStock = 1 OR p.syncPrice = 1)");
  }
  if (quickView === "outOfStock") {
    where.push("COALESCE(p.stock, 0) <= 0");
  }

  let stats: ProductStatsRow = {
    total: 0,
    onCount: 0,
    offCount: 0,
    olistCount: 0,
    missingPhotoCount: 0,
    syncingCount: 0,
    outOfStockCount: 0,
  };
  let items: ProductListRow[] = [];

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const wherePg: string[] = [];
    const paramsPg: Array<string | number> = [];
    let paramIndex = 1;

    if (q) {
      wherePg.push(`(lower(p.name) LIKE $${paramIndex} OR lower(p.slug) LIKE $${paramIndex + 1})`);
      paramsPg.push(`%${q}%`, `%${q}%`);
      paramIndex += 2;
    }

    if (active === "1" || active === "0") {
      wherePg.push(`p.active = $${paramIndex}`);
      paramsPg.push(Number(active));
      paramIndex += 1;
    }

    if (quickView === "olist") {
      wherePg.push(`p.externalsource = $${paramIndex}`);
      paramsPg.push("olist");
      paramIndex += 1;
    }
    if (quickView === "missingPhoto") {
      wherePg.push(
        `(SELECT COUNT(1) FROM product_images i WHERE i.productid = p.id) = 0`,
      );
    }
    if (quickView === "syncing") {
      wherePg.push("(p.syncstock = 1 OR p.syncprice = 1)");
    }
    if (quickView === "outOfStock") {
      wherePg.push("COALESCE(p.stock, 0) <= 0");
    }

    const whereClause = wherePg.length ? `WHERE ${wherePg.join(" AND ")}` : "";
    const statsResult = await pool.query<ProductStatsRow>(
      `
      SELECT
        COUNT(*)::int AS total,
        COALESCE(SUM(CASE WHEN p.active = 1 THEN 1 ELSE 0 END), 0)::int AS "onCount",
        COALESCE(SUM(CASE WHEN p.active = 0 THEN 1 ELSE 0 END), 0)::int AS "offCount",
        COALESCE(SUM(CASE WHEN p.externalsource = 'olist' THEN 1 ELSE 0 END), 0)::int AS "olistCount",
        COALESCE(SUM(
          CASE WHEN (
            SELECT COUNT(1) FROM product_images i WHERE i.productid = p.id
          ) = 0 THEN 1 ELSE 0 END
        ), 0)::int AS "missingPhotoCount",
        COALESCE(SUM(CASE WHEN p.syncstock = 1 OR p.syncprice = 1 THEN 1 ELSE 0 END), 0)::int AS "syncingCount",
        COALESCE(SUM(CASE WHEN COALESCE(p.stock, 0) <= 0 THEN 1 ELSE 0 END), 0)::int AS "outOfStockCount"
      FROM products p
      ${whereClause}
      `,
      paramsPg,
    );
    stats = statsResult.rows[0] ?? stats;

    const total = Number(stats.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * pageSize;

    const itemsResult = await pool.query<ProductListRow>(
      `
      SELECT
        p.id,
        p.slug,
        p.name,
        p.shortdescription AS "shortDescription",
        p.description,
        p.price,
        p.compareatprice AS "compareAtPrice",
        p.stock,
        p.sku,
        p.active,
        p.categoryid AS "categoryId",
        p.subcategoryid AS "subCategoryId",
        p.color,
        p.inmovingshowcase AS "inMovingShowcase",
        p.featured,
        p.deal,
        p.iscollection AS "isCollection",
        p.isweeklyfavorite AS "isWeeklyFavorite",
        p.externalsource AS "externalSource",
        p.externalsku AS "externalSku",
        p.syncstock AS "syncStock",
        p.syncprice AS "syncPrice",
        p.lastsyncedat AS "lastSyncedAt",
        p.createdat AS "createdAt",
        p.updatedat AS "updatedAt",
        COALESCE(
          (
            SELECT STRING_AGG(c2.name, ', ')
            FROM product_category_links pcl
            JOIN categories c2 ON c2.id = pcl.categoryid
            WHERE pcl.productid = p.id
          ),
          (SELECT c3.name FROM categories c3 WHERE c3.id = p.categoryid)
        ) AS "categoryNames",
        (
          SELECT url FROM product_images i
          WHERE i.productid = p.id
          ORDER BY i.sortorder ASC
          LIMIT 1
        ) AS "coverImage",
        (
          SELECT COUNT(1)::int FROM product_images i WHERE i.productid = p.id
        ) AS "imageCount"
      FROM products p
      ${whereClause}
      ORDER BY p.createdat DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...paramsPg, pageSize, offset],
    );
    items = itemsResult.rows;

    return NextResponse.json({
      ok: true,
      items,
      stats: {
        total: Number(stats.total || 0),
        on: Number(stats.onCount || 0),
        off: Number(stats.offCount || 0),
        olist: Number(stats.olistCount || 0),
        missingPhoto: Number(stats.missingPhotoCount || 0),
        syncing: Number(stats.syncingCount || 0),
        outOfStock: Number(stats.outOfStockCount || 0),
      },
      loadedCount: items.length,
      hasMore: safePage < totalPages,
      pagination: {
        page: safePage,
        pageSize,
        total,
        totalPages,
      },
    });
  }

  const { db } = await import("@/lib/db");
  const sql = `
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN p.active = 1 THEN 1 ELSE 0 END) AS onCount,
      SUM(CASE WHEN p.active = 0 THEN 1 ELSE 0 END) AS offCount,
      SUM(CASE WHEN p.externalSource = 'olist' THEN 1 ELSE 0 END) AS olistCount,
      SUM(
        CASE WHEN (
          SELECT COUNT(1) FROM product_images i WHERE i.productId = p.id
        ) = 0 THEN 1 ELSE 0 END
      ) AS missingPhotoCount,
      SUM(CASE WHEN p.syncStock = 1 OR p.syncPrice = 1 THEN 1 ELSE 0 END) AS syncingCount,
      SUM(CASE WHEN COALESCE(p.stock, 0) <= 0 THEN 1 ELSE 0 END) AS outOfStockCount
    FROM products p
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
  `;

  stats = (db.prepare(sql).get(...params) as ProductStatsRow | undefined) ?? stats;

  const itemsSql = `
    SELECT
      p.*,
      COALESCE(
        (
          SELECT GROUP_CONCAT(c2.name, ', ')
          FROM product_category_links pcl
          JOIN categories c2 ON c2.id = pcl.categoryId
          WHERE pcl.productId = p.id
        ),
        (SELECT c3.name FROM categories c3 WHERE c3.id = p.categoryId)
      ) AS categoryNames,
      (SELECT url FROM product_images i WHERE i.productId = p.id ORDER BY sortOrder ASC LIMIT 1) AS coverImage,
      (SELECT COUNT(1) FROM product_images i WHERE i.productId = p.id) AS imageCount
    FROM products p
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY p.createdAt DESC
    LIMIT ? OFFSET ?
  `;

  const total = Number(stats.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;
  items = db.prepare(itemsSql).all(...params, pageSize, offset) as ProductListRow[];
  return NextResponse.json({
    ok: true,
    items,
    stats: {
      total: Number(stats.total || 0),
      on: Number(stats.onCount || 0),
      off: Number(stats.offCount || 0),
      olist: Number(stats.olistCount || 0),
      missingPhoto: Number(stats.missingPhotoCount || 0),
      syncing: Number(stats.syncingCount || 0),
      outOfStock: Number(stats.outOfStockCount || 0),
    },
    loadedCount: items.length,
    hasMore: safePage < totalPages,
    pagination: {
      page: safePage,
      pageSize,
      total,
      totalPages,
    },
  });
}

export async function POST(req: Request) {
  const csrfError = validateCsrfRequest(req);
  if (csrfError) {
    return csrfError;
  }

  if (!(await isAdminSession())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as ProductBody | null;
  const id = String(body?.id || crypto.randomUUID());
  const now = Date.now();
  const name = String(body?.name || "").trim();
  let slug = String(body?.slug || "").trim();

  if (!name) {
    return NextResponse.json(
      { ok: false, error: "bad_request" },
      { status: 400 },
    );
  }

  if (!slug || slug.length < 2) {
    slug = slugify(name);
  }

  if (!slug) {
    return NextResponse.json(
      { ok: false, error: "bad_request" },
      { status: 400 },
    );
  }

  const categoryIds = normalizeCategoryIds(body?.categoryIds);
  const primaryCategoryId = categoryIds[0] ?? body?.categoryId ?? null;

  const images = Array.isArray(body?.images) ? body.images : [];
  const colorOptionsJson = serializeProductColorOptions(body?.colorOptions);
  const normalizedColorOptions = parseProductColorOptionsJson(colorOptionsJson);
  const mergedImages = mergeProductImagesWithColorOptions(
    images,
    normalizedColorOptions,
    name,
  );

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO products (
          id, slug, name, shortdescription, coloroptionsjson, description, price, compareatprice, stock, sku, active,
          categoryid, subcategoryid, color, inmovingshowcase, featured, deal, iscollection, isweeklyfavorite,
          externalsource, externalsku, syncstock, syncprice, lastsyncedat, createdat, updatedat
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)`,
        [
          id,
          slug,
          name,
          body?.shortDescription ?? null,
          colorOptionsJson,
          body?.description ?? null,
          Number(body?.price || 0),
          body?.compareAtPrice ?? null,
          Number(body?.stock || 0),
          body?.sku ?? null,
          Number(body?.active ?? 0),
          primaryCategoryId,
          normalizeTextValue(body?.subCategoryId),
          normalizeTextValue(body?.color),
          Number(body?.inMovingShowcase ?? 0),
          Number(body?.featured ?? 0),
          Number(body?.deal ?? 0),
          Number(body?.isCollection ?? 0),
          Number(body?.isWeeklyFavorite ?? 0),
          normalizeTextValue(body?.externalSource),
          normalizeTextValue(body?.externalSku),
          Number(body?.syncStock ? 1 : 0),
          Number(body?.syncPrice ? 1 : 0),
          body?.lastSyncedAt ?? null,
          now,
          now,
        ],
      );

      for (const categoryId of categoryIds) {
        await client.query(
          `INSERT INTO product_category_links (productid, categoryid, createdat)
           VALUES ($1, $2, $3)
           ON CONFLICT (productid, categoryid) DO NOTHING`,
          [id, categoryId, now],
        );
      }

      for (let index = 0; index < mergedImages.length; index += 1) {
        const image = mergedImages[index];
        await client.query(
          `INSERT INTO product_images (id, productid, url, alt, sortorder)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            crypto.randomUUID(),
            id,
            String(image.url || "").trim(),
            image.alt ?? null,
            Number(image.sortOrder ?? index),
          ],
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } else {
    const { db } = await import("@/lib/db");
    db.prepare(
      `INSERT INTO products (
        id, slug, name, shortDescription, colorOptionsJson, description, price, compareAtPrice, stock, sku, active,
        categoryId, subCategoryId, color, inMovingShowcase, featured, deal, isCollection, isWeeklyFavorite,
        externalSource, externalSku, syncStock, syncPrice, lastSyncedAt, createdAt, updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
    ).run(
      id,
      slug,
      name,
      body?.shortDescription ?? null,
      colorOptionsJson,
      body?.description ?? null,
      Number(body?.price || 0),
      body?.compareAtPrice ?? null,
      Number(body?.stock || 0),
      body?.sku ?? null,
      Number(body?.active ?? 0),
      primaryCategoryId,
      normalizeTextValue(body?.subCategoryId),
      normalizeTextValue(body?.color),
      Number(body?.inMovingShowcase ?? 0),
      Number(body?.featured ?? 0),
      Number(body?.deal ?? 0),
      Number(body?.isCollection ?? 0),
      Number(body?.isWeeklyFavorite ?? 0),
      normalizeTextValue(body?.externalSource),
      normalizeTextValue(body?.externalSku),
      Number(body?.syncStock ? 1 : 0),
      Number(body?.syncPrice ? 1 : 0),
      body?.lastSyncedAt ?? null,
      now,
      now,
    );

    const insertCategoryLink = db.prepare(
      "INSERT OR IGNORE INTO product_category_links (productId, categoryId, createdAt) VALUES (?, ?, ?)",
    );
    if (mergedImages.length) {
      const insertImage = db.prepare(
        "INSERT INTO product_images (id, productId, url, alt, sortOrder) VALUES (?, ?, ?, ?, ?)",
      );

      const tx = db.transaction(() => {
        for (const categoryId of categoryIds) {
          insertCategoryLink.run(id, categoryId, now);
        }

        for (let index = 0; index < mergedImages.length; index += 1) {
          const image = mergedImages[index];
          insertImage.run(
            crypto.randomUUID(),
            id,
            String(image.url || "").trim(),
            image.alt ?? null,
            Number(image.sortOrder ?? index),
          );
        }
      });

      tx();
    } else if (categoryIds.length) {
      const tx = db.transaction(() => {
        for (const categoryId of categoryIds) {
          insertCategoryLink.run(id, categoryId, now);
        }
      });
      tx();
    }
  }

  return NextResponse.json({ ok: true, id });
}
