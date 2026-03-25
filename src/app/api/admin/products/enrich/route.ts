import crypto from "crypto";
import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/adminAuth";
import { validateCsrfRequest } from "@/lib/csrf";
import { suggestProductEnrichment } from "@/lib/productEnrichment";
import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";

export const runtime = "nodejs";

type EnrichBody = {
  ids?: string[];
};

type ProductRow = {
  id: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  categoryId: string | null;
  subCategoryId: string | null;
};

type ProductCategoryRow = {
  categoryId: string;
};

type ProductImageCountRow = {
  total?: number | string;
};

function hasText(value: unknown) {
  return String(value ?? "").trim().length > 0;
}

export async function POST(req: Request) {
  const csrfError = validateCsrfRequest(req);
  if (csrfError) {
    return csrfError;
  }

  if (!(await isAdminSession())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as EnrichBody | null;
  const ids = Array.isArray(body?.ids)
    ? [...new Set(body.ids.map((value) => String(value || "").trim()).filter(Boolean))]
    : [];

  if (ids.length === 0) {
    return NextResponse.json(
      { ok: false, error: "bad_request" },
      { status: 400 },
    );
  }

  let processed = 0;
  let descriptionsFilled = 0;
  let categoriesFilled = 0;
  let imagesFilled = 0;

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      for (const id of ids) {
        const productResult = await client.query<ProductRow>(
          `SELECT
             id,
             name,
             shortdescription AS "shortDescription",
             description,
             categoryid AS "categoryId",
             subcategoryid AS "subCategoryId"
           FROM products
           WHERE id = $1
           LIMIT 1`,
          [id],
        );
        const product = productResult.rows[0];
        if (!product) continue;

        const [categoriesResult, imageCountResult] = await Promise.all([
          client.query<ProductCategoryRow>(
            `SELECT categoryid AS "categoryId"
             FROM product_category_links
             WHERE productid = $1
             ORDER BY createdat ASC`,
            [id],
          ),
          client.query<ProductImageCountRow>(
            `SELECT COUNT(1)::int AS total
             FROM product_images
             WHERE productid = $1`,
            [id],
          ),
        ]);

        const existingCategoryIds = categoriesResult.rows
          .map((row) => row.categoryId)
          .filter(Boolean);
        const suggestion = suggestProductEnrichment({
          name: product.name,
          description: product.description,
        });

        const nextShortDescription = hasText(product.shortDescription)
          ? product.shortDescription
          : suggestion.description;
        const nextDescription = hasText(product.description)
          ? product.description
          : suggestion.description;
        const nextCategoryIds =
          existingCategoryIds.length > 0
            ? existingCategoryIds
            : suggestion.categoryIds.filter(Boolean);
        const nextCategoryId =
          nextCategoryIds[0] ?? product.categoryId ?? suggestion.categoryId ?? null;
        const nextSubCategoryId = hasText(product.subCategoryId)
          ? product.subCategoryId
          : suggestion.subCategoryId;
        const imageCount = Number(imageCountResult.rows[0]?.total ?? 0);

        await client.query(
          `UPDATE products
           SET shortdescription = $1,
               description = $2,
               categoryid = $3,
               subcategoryid = $4,
               updatedat = $5
           WHERE id = $6`,
          [
            nextShortDescription,
            nextDescription,
            nextCategoryId,
            nextSubCategoryId,
            Date.now(),
            id,
          ],
        );

        if (existingCategoryIds.length === 0 && nextCategoryIds.length > 0) {
          for (const categoryId of nextCategoryIds) {
            await client.query(
              `INSERT INTO product_category_links (productid, categoryid, createdat)
               VALUES ($1, $2, $3)
               ON CONFLICT (productid, categoryid) DO NOTHING`,
              [id, categoryId, Date.now()],
            );
          }
          categoriesFilled += 1;
        }

        if (!hasText(product.shortDescription) || !hasText(product.description)) {
          descriptionsFilled += 1;
        }

        if (imageCount < 1) {
          await client.query(
            `INSERT INTO product_images (id, productid, url, alt, sortorder)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              crypto.randomUUID(),
              id,
              suggestion.imageUrl,
              product.name,
              0,
            ],
          );
          imagesFilled += 1;
        }

        processed += 1;
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
    const getProduct = db.prepare(
      `SELECT id, name, shortDescription, description, categoryId, subCategoryId
       FROM products
       WHERE id = ?
       LIMIT 1`,
    );
    const getCategoryIds = db.prepare(
      `SELECT categoryId
       FROM product_category_links
       WHERE productId = ?
       ORDER BY createdAt ASC`,
    );
    const getImageCount = db.prepare(
      `SELECT COUNT(1) AS total
       FROM product_images
       WHERE productId = ?`,
    );
    const updateProduct = db.prepare(
      `UPDATE products
       SET shortDescription = ?,
           description = ?,
           categoryId = ?,
           subCategoryId = ?,
           updatedAt = ?
       WHERE id = ?`,
    );
    const insertCategory = db.prepare(
      `INSERT OR IGNORE INTO product_category_links (productId, categoryId, createdAt)
       VALUES (?, ?, ?)`,
    );
    const insertImage = db.prepare(
      `INSERT INTO product_images (id, productId, url, alt, sortOrder)
       VALUES (?, ?, ?, ?, ?)`,
    );

    const tx = db.transaction(() => {
      for (const id of ids) {
        const product = getProduct.get(id) as ProductRow | undefined;
        if (!product) continue;

        const existingCategoryIds = (
          getCategoryIds.all(id) as ProductCategoryRow[]
        )
          .map((row) => row.categoryId)
          .filter(Boolean);
        const imageCount =
          Number(
            (getImageCount.get(id) as ProductImageCountRow | undefined)?.total ?? 0,
          ) || 0;
        const suggestion = suggestProductEnrichment({
          name: product.name,
          description: product.description,
        });

        const nextShortDescription = hasText(product.shortDescription)
          ? product.shortDescription
          : suggestion.description;
        const nextDescription = hasText(product.description)
          ? product.description
          : suggestion.description;
        const nextCategoryIds =
          existingCategoryIds.length > 0
            ? existingCategoryIds
            : suggestion.categoryIds.filter(Boolean);
        const nextCategoryId =
          nextCategoryIds[0] ?? product.categoryId ?? suggestion.categoryId ?? null;
        const nextSubCategoryId = hasText(product.subCategoryId)
          ? product.subCategoryId
          : suggestion.subCategoryId;

        updateProduct.run(
          nextShortDescription,
          nextDescription,
          nextCategoryId,
          nextSubCategoryId,
          Date.now(),
          id,
        );

        if (existingCategoryIds.length === 0 && nextCategoryIds.length > 0) {
          for (const categoryId of nextCategoryIds) {
            insertCategory.run(id, categoryId, Date.now());
          }
          categoriesFilled += 1;
        }

        if (!hasText(product.shortDescription) || !hasText(product.description)) {
          descriptionsFilled += 1;
        }

        if (imageCount < 1) {
          insertImage.run(
            crypto.randomUUID(),
            id,
            suggestion.imageUrl,
            product.name,
            0,
          );
          imagesFilled += 1;
        }

        processed += 1;
      }
    });

    tx();
  }

  return NextResponse.json({
    ok: true,
    processed,
    descriptionsFilled,
    categoriesFilled,
    imagesFilled,
  });
}
