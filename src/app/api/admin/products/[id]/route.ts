import { NextResponse } from "next/server";
import crypto from "crypto";
import { isAdminSession } from "@/lib/adminAuth";
import { normalizeCategoryIds, normalizeTextValue } from "@/lib/catalog";
import { validateCsrfRequest } from "@/lib/csrf";
import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";

export const runtime = "nodejs";

type ProductUpdateBodyImage = {
  url?: string;
  alt?: string | null;
  sortOrder?: number;
};

type ProductUpdateBody = {
  quick?: boolean;
  inMovingShowcase?: boolean | number;
  featured?: boolean | number;
  deal?: boolean | number;
  isCollection?: boolean | number;
  isWeeklyFavorite?: boolean | number;
  active?: boolean | number;
  externalSource?: string | null;
  externalSku?: string | null;
  syncStock?: boolean | number;
  syncPrice?: boolean | number;
  lastSyncedAt?: number | null;
  categoryId?: string | null;
  categoryIds?: string[];
  subCategoryId?: string | null;
  color?: string | null;
  name?: string;
  slug?: string;
  description?: string | null;
  price?: number | string;
  compareAtPrice?: number | string | null;
  stock?: number | string;
  sku?: string | null;
  images?: ProductUpdateBodyImage[];
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

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const csrfError = validateCsrfRequest(req);
  if (csrfError) {
    return csrfError;
  }

  if (!(await isAdminSession())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { id } = await ctx.params;
  const productId = decodeURIComponent(id);
  const body = (await req.json().catch(() => null)) as ProductUpdateBody | null;

  if (body?.quick === true) {
    const sets: string[] = [];
    const params: Array<string | number | null> = [];

    if (typeof body.featured !== "undefined") {
      sets.push("featured = ?");
      params.push(Number(body.featured ? 1 : 0));
    }
    if (typeof body.deal !== "undefined") {
      sets.push("deal = ?");
      params.push(Number(body.deal ? 1 : 0));
    }
    if (typeof body.isCollection !== "undefined") {
      sets.push("isCollection = ?");
      params.push(Number(body.isCollection ? 1 : 0));
    }
    if (typeof body.isWeeklyFavorite !== "undefined") {
      sets.push("isWeeklyFavorite = ?");
      params.push(Number(body.isWeeklyFavorite ? 1 : 0));
    }
    if (typeof body.active !== "undefined") {
      sets.push("active = ?");
      params.push(Number(body.active ? 1 : 0));
    }
    if (typeof body.inMovingShowcase !== "undefined") {
      sets.push("inMovingShowcase = ?");
      params.push(Number(body.inMovingShowcase ? 1 : 0));
    }
    if (typeof body.categoryId !== "undefined") {
      sets.push("categoryId = ?");
      params.push(body.categoryId ?? null);
    }
    if (typeof body.externalSource !== "undefined") {
      sets.push("externalSource = ?");
      params.push(normalizeTextValue(body.externalSource));
    }
    if (typeof body.externalSku !== "undefined") {
      sets.push("externalSku = ?");
      params.push(normalizeTextValue(body.externalSku));
    }
    if (typeof body.syncStock !== "undefined") {
      sets.push("syncStock = ?");
      params.push(Number(body.syncStock ? 1 : 0));
    }
    if (typeof body.syncPrice !== "undefined") {
      sets.push("syncPrice = ?");
      params.push(Number(body.syncPrice ? 1 : 0));
    }
    if (typeof body.lastSyncedAt !== "undefined") {
      sets.push("lastSyncedAt = ?");
      params.push(body.lastSyncedAt ?? null);
    }

    if (!sets.length) {
      return NextResponse.json(
        { ok: false, error: "bad_request" },
        { status: 400 },
      );
    }

    sets.push("updatedAt = ?");
    params.push(Date.now(), productId);
    if (hasPostgresConfig()) {
      const pool = getPostgresPool();
      const pgFieldMap: Record<string, string> = {
        isCollection: "iscollection",
        isWeeklyFavorite: "isweeklyfavorite",
        inMovingShowcase: "inmovingshowcase",
        categoryId: "categoryid",
        externalSource: "externalsource",
        externalSku: "externalsku",
        syncStock: "syncstock",
        syncPrice: "syncprice",
        lastSyncedAt: "lastsyncedat",
        updatedAt: "updatedat",
      };
      const convertedSets = sets.map((set, index) => {
        const [field] = set.split(" = ");
        const safeField = pgFieldMap[field] ?? field;
        return `${safeField} = $${index + 1}`;
      });
      await pool.query(
        `UPDATE products SET ${convertedSets.join(", ")} WHERE id = $${params.length}`,
        params,
      );
    } else {
      const { db } = await import("@/lib/db");
      db.prepare(`UPDATE products SET ${sets.join(", ")} WHERE id = ?`).run(
        ...params,
      );
    }

    return NextResponse.json({ ok: true });
  }

  const name = String(body?.name || "").trim();
  let slug = String(body?.slug || "").trim();
  const categoryIds = normalizeCategoryIds(body?.categoryIds);
  const primaryCategoryId = categoryIds[0] ?? body?.categoryId ?? null;

  if (!name) {
    return NextResponse.json(
      { ok: false, error: "bad_request" },
      { status: 400 },
    );
  }

  if (!slug || slug.length < 2) slug = slugify(name);
  if (!slug) {
    return NextResponse.json(
      { ok: false, error: "bad_request" },
      { status: 400 },
    );
  }

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    await pool.query(
      `
      UPDATE products
      SET slug=$1, name=$2, description=$3, price=$4, compareatprice=$5, stock=$6, sku=$7, active=$8,
          categoryid=$9, subcategoryid=$10, color=$11, inmovingshowcase=$12, featured=$13, deal=$14, iscollection=$15, isweeklyfavorite=$16,
          externalsource=$17, externalsku=$18, syncstock=$19, syncprice=$20, lastsyncedat=$21, updatedat=$22
      WHERE id=$23
      `,
      [
        slug,
        name,
        body?.description ?? null,
        Number(body?.price || 0),
        body?.compareAtPrice ?? null,
        Number(body?.stock || 0),
        body?.sku ?? null,
        Number(body?.active ?? 1),
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
        Date.now(),
        productId,
      ],
    );
  } else {
    const { db } = await import("@/lib/db");
    db.prepare(
      `
      UPDATE products
      SET slug=?, name=?, description=?, price=?, compareAtPrice=?, stock=?, sku=?, active=?,
          categoryId=?, subCategoryId=?, color=?, inMovingShowcase=?, featured=?, deal=?, isCollection=?, isWeeklyFavorite=?,
          externalSource=?, externalSku=?, syncStock=?, syncPrice=?, lastSyncedAt=?, updatedAt=?
      WHERE id=?
      `,
    ).run(
      slug,
      name,
      body?.description ?? null,
      Number(body?.price || 0),
      body?.compareAtPrice ?? null,
      Number(body?.stock || 0),
      body?.sku ?? null,
      Number(body?.active ?? 1),
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
      Date.now(),
      productId,
    );
  }

  const imgs = Array.isArray(body?.images) ? body.images : [];
  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM product_images WHERE productid = $1`, [productId]);
      await client.query(`DELETE FROM product_category_links WHERE productid = $1`, [productId]);

      for (const categoryId of categoryIds) {
        await client.query(
          `INSERT INTO product_category_links (productid, categoryid, createdat)
           VALUES ($1, $2, $3)
           ON CONFLICT (productid, categoryid) DO NOTHING`,
          [productId, categoryId, Date.now()],
        );
      }

      for (let i = 0; i < imgs.length; i++) {
        const it = imgs[i];
        if (!it) continue;
        const url = String(it.url || "").trim();
        if (!url) continue;
        await client.query(
          `INSERT INTO product_images (id, productid, url, alt, sortorder)
           VALUES ($1, $2, $3, $4, $5)`,
          [crypto.randomUUID(), productId, url, it.alt ?? null, Number(it.sortOrder ?? i)],
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
    const del = db.prepare(`DELETE FROM product_images WHERE productId = ?`);
    const delCategories = db.prepare(
      `DELETE FROM product_category_links WHERE productId = ?`,
    );
    const ins = db.prepare(
      `INSERT INTO product_images (id, productId, url, alt, sortOrder) VALUES (?, ?, ?, ?, ?)`,
    );
    const insCategory = db.prepare(
      `INSERT OR IGNORE INTO product_category_links (productId, categoryId, createdAt) VALUES (?, ?, ?)`,
    );

    const tx = db.transaction(() => {
      del.run(productId);
      delCategories.run(productId);

      for (const categoryId of categoryIds) {
        insCategory.run(productId, categoryId, Date.now());
      }

      for (let i = 0; i < imgs.length; i++) {
        const it = imgs[i];
        if (!it) continue;
        const url = String(it.url || "").trim();
        if (!url) continue;
        ins.run(
          crypto.randomUUID(),
          productId,
          url,
          it.alt ?? null,
          Number(it.sortOrder ?? i),
        );
      }
    });
    tx();
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const csrfError = validateCsrfRequest(req);
  if (csrfError) {
    return csrfError;
  }

  if (!(await isAdminSession())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { id } = await ctx.params;
  const productId = decodeURIComponent(id);
  let deleted = 0;

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const productResult = await client.query<{
        externalSource: string | null;
        externalSku: string | null;
      }>(
        `SELECT externalsource as "externalSource", externalsku as "externalSku"
         FROM products
         WHERE id = $1
         LIMIT 1`,
        [productId],
      );
      const product = productResult.rows[0];

      if (product?.externalSource === "olist" && product.externalSku) {
        await client.query(
          `INSERT INTO external_product_blocks (source, externalsku, createdat)
           VALUES ('olist', $1, $2)
           ON CONFLICT (source, externalsku) DO NOTHING`,
          [product.externalSku, Date.now()],
        );
      }

      const result = await client.query(`DELETE FROM products WHERE id = $1`, [productId]);
      deleted = result.rowCount ?? 0;
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } else {
    const { db } = await import("@/lib/db");
    const product = db
      .prepare(
        "SELECT externalSource, externalSku FROM products WHERE id = ? LIMIT 1",
      )
      .get(productId) as
      | { externalSource: string | null; externalSku: string | null }
      | undefined;

    const result = db.transaction(() => {
      if (product?.externalSource === "olist" && product.externalSku) {
        db.prepare(
          `
            INSERT OR IGNORE INTO external_product_blocks (source, externalSku, createdAt)
            VALUES ('olist', ?, ?)
          `,
        ).run(product.externalSku, Date.now());
      }

      return db.prepare("DELETE FROM products WHERE id = ?").run(productId);
    })();
    deleted = result.changes;
  }

  if (deleted < 1) {
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
