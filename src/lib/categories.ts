import { DEFAULT_CATEGORIES } from "@/lib/catalog";
import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";

export async function ensureDefaultCategories() {
  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const now = Date.now();

    for (const category of DEFAULT_CATEGORIES) {
      await pool.query(
        `
          INSERT INTO categories (id, name, sortorder, active, createdat, updatedat)
          VALUES ($1, $2, $3, 1, $4, $4)
          ON CONFLICT (id) DO UPDATE
          SET name = EXCLUDED.name,
              sortorder = EXCLUDED.sortorder,
              active = 1,
              updatedat = EXCLUDED.updatedat
        `,
        [category.id, category.name, category.sortOrder, now],
      );
    }

    return;
  }

  const { db } = await import("@/lib/db");
  const now = Date.now();
  const insertCategory = db.prepare(`
    INSERT OR IGNORE INTO categories (id, name, sortOrder, active, createdAt, updatedAt)
    VALUES (?, ?, ?, 1, ?, ?)
  `);
  const updateCategory = db.prepare(`
    UPDATE categories
    SET name = ?, sortOrder = ?, active = 1, updatedAt = ?
    WHERE id = ?
  `);

  for (const category of DEFAULT_CATEGORIES) {
    insertCategory.run(category.id, category.name, category.sortOrder, now, now);
    updateCategory.run(category.name, category.sortOrder, now, category.id);
  }
}
