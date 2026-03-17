import { NextResponse } from "next/server";
import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";

export const runtime = "nodejs";

export async function GET() {
  try {
    let ok = 0;

    if (hasPostgresConfig()) {
      const pool = getPostgresPool();
      const result = await pool.query<{ ok: number }>("SELECT 1 as ok");
      ok = Number(result.rows[0]?.ok || 0);
    } else {
      const { db } = await import("@/lib/db");
      const row = db.prepare("SELECT 1 as ok").get() as { ok: number } | undefined;
      ok = Number(row?.ok || 0);
    }

    return NextResponse.json({
      ok: true,
      database: ok === 1 ? "up" : "unknown",
      timestamp: Date.now(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unknown_error";

    return NextResponse.json(
      {
        ok: false,
        database: "down",
        error: message,
        timestamp: Date.now(),
      },
      { status: 500 },
    );
  }
}
