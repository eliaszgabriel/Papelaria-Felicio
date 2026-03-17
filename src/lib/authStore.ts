import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";

export type AuthUserRow = {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  cpf: string | null;
  created_at?: string;
  password_hash: string | null;
  email_verified: number | null;
  email_verified_at?: string | null;
};

export async function getUserByEmail(email: string) {
  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const result = await pool.query<AuthUserRow>(
      `SELECT id, email, name, phone, cpf, created_at, password_hash, email_verified, email_verified_at
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [email],
    );
    return result.rows[0];
  }

  const { db } = await import("@/lib/db");
  return db
    .prepare(
      "SELECT id, email, name, phone, cpf, created_at, password_hash, email_verified, email_verified_at FROM users WHERE email = ? LIMIT 1",
    )
    .get(email) as AuthUserRow | undefined;
}

export async function getUserByCpf(cpf: string) {
  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const result = await pool.query<AuthUserRow>(
      `SELECT id, email, name, phone, cpf, created_at, password_hash, email_verified, email_verified_at
       FROM users
       WHERE cpf = $1
       LIMIT 1`,
      [cpf],
    );
    return result.rows[0];
  }

  const { db } = await import("@/lib/db");
  return db
    .prepare(
      "SELECT id, email, name, phone, cpf, created_at, password_hash, email_verified, email_verified_at FROM users WHERE cpf = ? LIMIT 1",
    )
    .get(cpf) as AuthUserRow | undefined;
}

export async function getUserById(id: string | number) {
  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const result = await pool.query<AuthUserRow>(
      `SELECT id, email, name, phone, cpf, created_at, password_hash, email_verified, email_verified_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [id],
    );
    return result.rows[0];
  }

  const { db } = await import("@/lib/db");
  return db
    .prepare(
      "SELECT id, email, name, phone, cpf, created_at, password_hash, email_verified, email_verified_at FROM users WHERE id = ? LIMIT 1",
    )
    .get(id) as AuthUserRow | undefined;
}

export async function createUser(input: {
  email: string;
  passwordHash: string;
  name: string | null;
  phone: string | null;
  cpf: string | null;
  emailVerified?: number;
}) {
  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const result = await pool.query<{ id: number }>(
      `INSERT INTO users (email, password_hash, name, phone, cpf, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        input.email,
        input.passwordHash,
        input.name,
        input.phone,
        input.cpf,
        Number(input.emailVerified ?? 0),
      ],
    );
    return result.rows[0]?.id ?? 0;
  }

  const { db } = await import("@/lib/db");
  const info = db
    .prepare(
      `INSERT INTO users (email, password_hash, name, phone, cpf, email_verified) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.email,
      input.passwordHash,
      input.name,
      input.phone,
      input.cpf,
      Number(input.emailVerified ?? 0),
    );
  return Number(info.lastInsertRowid);
}

export async function updateUserPassword(id: number, passwordHash: string) {
  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    await pool.query(
      `UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [passwordHash, id],
    );
    return;
  }

  const { db } = await import("@/lib/db");
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
    passwordHash,
    id,
  );
}

export async function markUserEmailVerified(email: string) {
  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    await pool.query(
      `UPDATE users
       SET email_verified = 1,
           email_verified_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE email = $1`,
      [email],
    );
    return;
  }

  const { db } = await import("@/lib/db");
  db.prepare(
    "UPDATE users SET email_verified = 1, email_verified_at = datetime('now'), updated_at = datetime('now') WHERE email = ?",
  ).run(email);
}
