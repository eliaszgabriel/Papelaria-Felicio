import { Pool } from "pg";

const POSTGRES_URL = process.env.POSTGRES_URL || "";

let pool: Pool | null = null;

export function hasPostgresConfig() {
  return Boolean(POSTGRES_URL);
}

function normalizePostgresUrl(connectionString: string) {
  const url = new URL(connectionString);
  url.searchParams.delete("sslmode");
  url.searchParams.delete("ssl");
  return url.toString();
}

export function getPostgresPool() {
  if (!POSTGRES_URL) {
    throw new Error("postgres_not_configured");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: normalizePostgresUrl(POSTGRES_URL),
      max: 10,
      ssl:
        process.env.POSTGRES_SSL === "require"
          ? { rejectUnauthorized: false }
          : undefined,
    });
  }

  return pool;
}
