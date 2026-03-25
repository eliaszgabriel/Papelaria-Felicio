import crypto from "crypto";
import type { OlistProductInput } from "./olist";
import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";

type ExistingImportedProduct = {
  id: string;
};

type BlockedExternalProduct = {
  externalSku: string;
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

async function buildUniqueSlug(baseName: string, externalSku: string) {
  const base = slugify(baseName) || slugify(externalSku) || crypto.randomUUID();
  let candidate = base;
  let suffix = 1;

  while (true) {
    let exists = false;
    if (hasPostgresConfig()) {
      const pool = getPostgresPool();
      const result = await pool.query(`SELECT 1 FROM products WHERE slug = $1 LIMIT 1`, [
        candidate,
      ]);
      exists = Boolean(result.rows[0]);
    } else {
      const { db } = await import("@/lib/db");
      exists = Boolean(
        db.prepare("SELECT 1 FROM products WHERE slug = ? LIMIT 1").get(candidate),
      );
    }

    if (!exists) {
      break;
    }

    suffix += 1;
    candidate = `${base}-${suffix}`;
  }

  return candidate;
}

export async function importOlistProducts(
  items: OlistProductInput[],
  options?: { ignoreBlocked?: boolean },
) {
  const now = Date.now();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const uniqueItems = new Map<string, OlistProductInput>();

  for (const item of items) {
    const sku = item.externalSku?.trim();
    if (!sku) {
      skipped += 1;
      continue;
    }

    uniqueItems.set(sku, {
      ...item,
      externalSku: sku,
    });
  }

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const item of uniqueItems.values()) {
        if (!item.name) {
          skipped += 1;
          continue;
        }

        const blockedResult = await client.query<BlockedExternalProduct>(
          `SELECT externalsku as "externalSku"
           FROM external_product_blocks
           WHERE source = 'olist' AND externalsku = $1
           LIMIT 1`,
          [item.externalSku],
        );
        const blocked = blockedResult.rows[0];
        if (blocked && !options?.ignoreBlocked) {
          skipped += 1;
          continue;
        }

        const existingResult = await client.query<ExistingImportedProduct>(
          `SELECT id
           FROM products
           WHERE externalsource = 'olist' AND externalsku = $1
           LIMIT 1`,
          [item.externalSku],
        );
        const existing = existingResult.rows[0];

        if (existing) {
          await client.query(
            `UPDATE products
             SET name = $1,
                 description = $2,
                 price = CASE WHEN syncprice = 1 THEN $3 ELSE price END,
                 stock = CASE WHEN syncstock = 1 THEN $4 ELSE stock END,
                 sku = $5,
                 active = $6,
                 lastsyncedat = $7,
                 updatedat = $8
             WHERE id = $9`,
            [
              item.name,
              item.description,
              item.price,
              item.stock,
              item.externalSku,
              item.active ? 1 : 0,
              now,
              now,
              existing.id,
            ],
          );
          const imageCountResult = await client.query<{ total?: number }>(
            `SELECT COUNT(1)::int as total FROM product_images WHERE productid = $1`,
            [existing.id],
          );
          const imageCount = imageCountResult.rows[0]?.total ?? 0;
          if (imageCount < 1 && item.photoUrl) {
            await client.query(
              `INSERT INTO product_images (id, productid, url, alt, sortorder)
               VALUES ($1, $2, $3, $4, $5)`,
              [crypto.randomUUID(), existing.id, item.photoUrl, item.name, 0],
            );
          }
          updated += 1;
          continue;
        }

        const productId = crypto.randomUUID();
        await client.query(
          `INSERT INTO products (
            id, slug, name, description, price, compareatprice, stock, sku, active,
            categoryid, subcategoryid, color, featured, deal, iscollection, isweeklyfavorite,
            externalsource, externalsku, syncstock, syncprice, lastsyncedat, createdat, updatedat
          )
          VALUES ($1, $2, $3, $4, $5, NULL, $6, $7, $8, NULL, NULL, NULL, 0, 0, 0, 0, 'olist', $9, 1, 1, $10, $11, $12)`,
          [
            productId,
            await buildUniqueSlug(item.name, item.externalSku),
            item.name,
            item.description,
            item.price,
            item.stock,
            item.externalSku,
            0,
            item.externalSku,
            now,
            now,
            now,
          ],
        );
        if (item.photoUrl) {
          await client.query(
            `INSERT INTO product_images (id, productid, url, alt, sortorder)
             VALUES ($1, $2, $3, $4, $5)`,
            [crypto.randomUUID(), productId, item.photoUrl, item.name, 0],
          );
        }
        created += 1;
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
    const buildUniqueSlugSqlite = (baseName: string, externalSku: string) => {
      const base = slugify(baseName) || slugify(externalSku) || crypto.randomUUID();
      let candidate = base;
      let suffix = 1;
      while (db.prepare("SELECT 1 FROM products WHERE slug = ? LIMIT 1").get(candidate)) {
        suffix += 1;
        candidate = `${base}-${suffix}`;
      }
      return candidate;
    };
    const findImported = db.prepare(
      "SELECT id FROM products WHERE externalSource = 'olist' AND externalSku = ? LIMIT 1",
    );
    const countImages = db.prepare(
      "SELECT COUNT(1) as total FROM product_images WHERE productId = ?",
    );
    const findBlocked = db.prepare(
      "SELECT externalSku FROM external_product_blocks WHERE source = 'olist' AND externalSku = ? LIMIT 1",
    );
    const insertProduct = db.prepare(`
      INSERT INTO products (
        id, slug, name, description, price, compareAtPrice, stock, sku, active,
        categoryId, subCategoryId, color, featured, deal, isCollection, isWeeklyFavorite,
        externalSource, externalSku, syncStock, syncPrice, lastSyncedAt, createdAt, updatedAt
      )
      VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL, NULL, NULL, 0, 0, 0, 0, 'olist', ?, 1, 1, ?, ?, ?)
    `);
    const updateImported = db.prepare(`
      UPDATE products
      SET name = ?,
          description = ?,
          price = CASE WHEN syncPrice = 1 THEN ? ELSE price END,
          stock = CASE WHEN syncStock = 1 THEN ? ELSE stock END,
          sku = ?,
          active = ?,
          lastSyncedAt = ?,
          updatedAt = ?
      WHERE id = ?
    `);
    const insertImage = db.prepare(
      `INSERT INTO product_images (id, productId, url, alt, sortOrder) VALUES (?, ?, ?, ?, ?)`,
    );

    const tx = db.transaction(() => {
    for (const item of uniqueItems.values()) {
      if (!item.name) {
        skipped += 1;
        continue;
      }

      const blocked = findBlocked.get(item.externalSku) as BlockedExternalProduct | undefined;
      if (blocked && !options?.ignoreBlocked) {
        skipped += 1;
        continue;
      }

      const existing = findImported.get(item.externalSku) as ExistingImportedProduct | undefined;
      if (existing) {
        updateImported.run(
          item.name,
          item.description,
          item.price,
          item.stock,
          item.externalSku,
          item.active ? 1 : 0,
          now,
          now,
          existing.id,
        );
        const imageCount =
          (
            countImages.get(existing.id) as { total?: number } | undefined
          )?.total ?? 0;
        if (imageCount < 1 && item.photoUrl) {
          insertImage.run(
            crypto.randomUUID(),
            existing.id,
            item.photoUrl,
            item.name,
            0,
          );
        }
        updated += 1;
        continue;
      }

      const productId = crypto.randomUUID();
      insertProduct.run(
        productId,
        buildUniqueSlugSqlite(item.name, item.externalSku),
        item.name,
        item.description,
        item.price,
        item.stock,
        item.externalSku,
        0,
        item.externalSku,
        now,
        now,
        now,
      );
      if (item.photoUrl) {
        insertImage.run(
          crypto.randomUUID(),
          productId,
          item.photoUrl,
          item.name,
          0,
        );
      }
      created += 1;
    }
    });

    tx();
  }

  return {
    ok: true as const,
    total: uniqueItems.size,
    created,
    updated,
    skipped,
    syncedAt: now,
  };
}
