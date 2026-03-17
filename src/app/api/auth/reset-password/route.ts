import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { validateCsrfRequest } from "@/lib/csrf";
import {
  matchesPasswordResetFingerprint,
  verifyPasswordResetToken,
} from "@/lib/passwordReset";
import { getUserByEmail } from "@/lib/authStore";
import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";

type UserRow = {
  id: number;
  password_hash: string | null;
};

export async function POST(req: Request) {
  const csrfError = validateCsrfRequest(req);
  if (csrfError) {
    return csrfError;
  }

  const body = await req.json().catch(() => null);
  const token = String(body?.token || "");
  const password = String(body?.password || "");

  if (!token) {
    return NextResponse.json(
      { ok: false, reason: "Link inválido." },
      { status: 400 },
    );
  }

  if (!password || password.length < 6) {
    return NextResponse.json(
      { ok: false, reason: "A senha precisa ter pelo menos 6 caracteres." },
      { status: 400 },
    );
  }

  const payload = verifyPasswordResetToken(token);
  if (!payload?.email) {
    return NextResponse.json(
      { ok: false, reason: "Esse link expirou ou não é mais válido." },
      { status: 400 },
    );
  }

  const user = (await getUserByEmail(payload.email)) as UserRow | undefined;

  if (!user) {
    return NextResponse.json(
      { ok: false, reason: "Conta não encontrada." },
      { status: 404 },
    );
  }

  if (!matchesPasswordResetFingerprint(payload.hash, user.password_hash)) {
    return NextResponse.json(
      { ok: false, reason: "Esse link expirou ou não é mais válido." },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    await pool.query(
      `UPDATE users
       SET password_hash = $1,
           email_verified = 1,
           email_verified_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [passwordHash, user.id],
    );
  } else {
    const { db } = await import("@/lib/db");
    db.prepare(
      "UPDATE users SET password_hash = ?, email_verified = 1, email_verified_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
    ).run(passwordHash, user.id);
  }

  return NextResponse.json({ ok: true });
}
