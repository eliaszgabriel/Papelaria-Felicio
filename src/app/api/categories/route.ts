import { NextResponse } from "next/server";
import { CATEGORY_NAME_BY_ID, DEFAULT_CATEGORIES } from "@/lib/catalog";
import { ensureDefaultCategories } from "@/lib/categories";
import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";

export const runtime = "nodejs";

export async function GET() {
  await ensureDefaultCategories();

  let rows: Array<{ id: string; name: string }> = [];

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const result = await pool.query<{ id: string; name: string }>(
      `SELECT id, name FROM categories WHERE active = 1 ORDER BY sortorder ASC, name ASC`,
    );
    rows = result.rows;
  } else {
    const { db } = await import("@/lib/db");
    rows = db
      .prepare(
        `SELECT id, name FROM categories WHERE active = 1 ORDER BY sortOrder ASC, name ASC`,
      )
      .all() as Array<{ id: string; name: string }>;
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

  return NextResponse.json({
    ok: true,
    items: rows.map((row) => ({
      id: row.id,
      name: CATEGORY_NAME_BY_ID[row.id] ?? row.name,
    })),
  });
}
