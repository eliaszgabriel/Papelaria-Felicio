import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";

type RateLimitOptions = {
  scope: string;
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
};

function normalizePart(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .slice(0, 200);
}

export function getRequestIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown";
}

export async function consumeRateLimit({
  scope,
  key,
  limit,
  windowMs,
}: RateLimitOptions): Promise<RateLimitResult> {
  const now = Date.now();
  const bucketKey = `${normalizePart(scope)}:${normalizePart(key)}`;

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    await pool.query(`DELETE FROM request_rate_limits WHERE resetat < $1`, [now]);

    const rowResult = await pool.query<{
      key: string;
      count: number;
      resetAt: string | number;
    }>(
      `SELECT key, count, resetat AS "resetAt" FROM request_rate_limits WHERE key = $1 LIMIT 1`,
      [bucketKey],
    );
    const row = rowResult.rows[0];

    if (!row || now >= Number(row.resetAt)) {
      await pool.query(
        `
          INSERT INTO request_rate_limits (key, count, resetat, updatedat)
          VALUES ($1, 1, $2, $3)
          ON CONFLICT(key) DO UPDATE SET
            count = 1,
            resetat = EXCLUDED.resetat,
            updatedat = EXCLUDED.updatedat
        `,
        [bucketKey, now + windowMs, now],
      );

      return {
        ok: true,
        remaining: Math.max(0, limit - 1),
        retryAfterMs: 0,
      };
    }

    const nextCount = Number(row.count || 0) + 1;
    await pool.query(
      `UPDATE request_rate_limits SET count = $1, updatedat = $2 WHERE key = $3`,
      [nextCount, now, bucketKey],
    );

    if (nextCount > limit) {
      return {
        ok: false,
        remaining: 0,
        retryAfterMs: Math.max(0, Number(row.resetAt) - now),
      };
    }

    return {
      ok: true,
      remaining: Math.max(0, limit - nextCount),
      retryAfterMs: 0,
    };
  }

  const { db } = await import("@/lib/db");
  db.prepare(`DELETE FROM request_rate_limits WHERE resetAt < ?`).run(now);

  const row = db
    .prepare(
      `SELECT key, count, resetAt FROM request_rate_limits WHERE key = ? LIMIT 1`,
    )
    .get(bucketKey) as
    | {
        key: string;
        count: number;
        resetAt: number;
      }
    | undefined;

  if (!row || now >= Number(row.resetAt)) {
    db.prepare(
      `
        INSERT INTO request_rate_limits (key, count, resetAt, updatedAt)
        VALUES (?, 1, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          count = 1,
          resetAt = excluded.resetAt,
          updatedAt = excluded.updatedAt
      `,
    ).run(bucketKey, now + windowMs, now);

    return {
      ok: true,
      remaining: Math.max(0, limit - 1),
      retryAfterMs: 0,
    };
  }

  const nextCount = Number(row.count || 0) + 1;
  db.prepare(
    `UPDATE request_rate_limits SET count = ?, updatedAt = ? WHERE key = ?`,
  ).run(nextCount, now, bucketKey);

  if (nextCount > limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterMs: Math.max(0, Number(row.resetAt) - now),
    };
  }

  return {
    ok: true,
    remaining: Math.max(0, limit - nextCount),
    retryAfterMs: 0,
  };
}
