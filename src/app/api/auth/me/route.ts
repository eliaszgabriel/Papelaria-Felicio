import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";
import { getJwtSecret } from "@/lib/runtimeSecrets";


type SessionPayload = {
  sub: string | number;
};

type UserRow = {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  cpf: string | null;
  created_at: string;
  password_hash: string | null;
  email_verified: number | null;
};

export async function GET() {
  const jwtSecret = getJwtSecret();
  if (!jwtSecret) {
    return NextResponse.json(
      { ok: false, reason: "server_not_configured" },
      { status: 500 },
    );
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("pf_session")?.value;

  if (!token) {
    return NextResponse.json({ ok: true, user: null });
  }

  try {
    const payload = jwt.verify(token, jwtSecret) as SessionPayload;
    let user: UserRow | undefined;

    if (hasPostgresConfig()) {
      const pool = getPostgresPool();
      const result = await pool.query<UserRow>(
        `SELECT id, email, name, phone, cpf, created_at, password_hash, email_verified FROM users WHERE id = $1 LIMIT 1`,
        [payload.sub],
      );
      user = result.rows[0];
    } else {
      const { db } = await import("@/lib/db");
      user = db
        .prepare(
          "SELECT id, email, name, phone, cpf, created_at, password_hash, email_verified FROM users WHERE id = ?",
        )
        .get(payload.sub) as UserRow | undefined;
    }

    if (!user) {
      return NextResponse.json({ ok: true, user: null });
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        cpf: user.cpf ?? null,
        created_at: user.created_at,
        hasPassword: Boolean(user.password_hash),
        emailVerified: Number(user.email_verified ?? 0) === 1,
      },
    });
  } catch {
    return NextResponse.json({ ok: true, user: null });
  }
}
