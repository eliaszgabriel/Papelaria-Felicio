import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";

const CURSOR_ID = "olist-auto-sync";

type CursorRow = {
  page: number;
  offset: number;
};

export async function getOlistSyncCursor() {
  let row: CursorRow | undefined;

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const result = await pool.query<CursorRow>(
      `SELECT page, "offset" as offset FROM integration_cursors WHERE id = $1 LIMIT 1`,
      [CURSOR_ID],
    );
    row = result.rows[0];
  } else {
    const { db } = await import("@/lib/db");
    row = db
      .prepare("SELECT page, offset FROM integration_cursors WHERE id = ? LIMIT 1")
      .get(CURSOR_ID) as CursorRow | undefined;
  }

  return {
    page: Math.max(1, Number(row?.page ?? 1)),
    offset: Math.max(0, Number(row?.offset ?? 0)),
  };
}

export async function saveOlistSyncCursor(page: number, offset: number) {
  const now = Date.now();

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    await pool.query(
      `
        INSERT INTO integration_cursors (id, page, "offset", "updatedAt")
        VALUES ($1, $2, $3, $4)
        ON CONFLICT(id) DO UPDATE SET
          page = excluded.page,
          "offset" = excluded."offset",
          "updatedAt" = excluded."updatedAt"
      `,
      [CURSOR_ID, Math.max(1, page), Math.max(0, offset), now],
    );
    return;
  }

  const { db } = await import("@/lib/db");
  db.prepare(
    `
      INSERT INTO integration_cursors (id, page, offset, updatedAt)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        page = excluded.page,
        offset = excluded.offset,
        updatedAt = excluded.updatedAt
    `,
  ).run(CURSOR_ID, Math.max(1, page), Math.max(0, offset), now);
}
