import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateCsrfRequest } from "@/lib/csrf";
import { isValidCPF, onlyDigits } from "@/lib/validators";
import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";
import { verifySessionToken } from "@/lib/sessionToken";

export const runtime = "nodejs";


type ProfileRow = {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  cpf: string | null;
  created_at: string;
  updated_at: string | null;
};

type ProfilePatchBody = {
  name?: string;
  phone?: string;
  cpf?: string;
};

async function getUserIdFromSession(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("pf_session")?.value;
  const payload = verifySessionToken(token);
  return payload ? Number(payload.sub) : null;
}

export async function GET() {
  const userId = await getUserIdFromSession();
  if (!userId) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let user: ProfileRow | undefined;

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const result = await pool.query<ProfileRow>(
      `SELECT id, email, name, phone, cpf, created_at, updated_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId],
    );
    user = result.rows[0];
  } else {
    const { db } = await import("@/lib/db");
    user = db
      .prepare(
        "SELECT id, email, name, phone, cpf, created_at, updated_at FROM users WHERE id = ?",
      )
      .get(userId) as ProfileRow | undefined;
  }

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  return NextResponse.json({ ok: true, user });
}

export async function PATCH(req: Request) {
  const csrfError = validateCsrfRequest(req);
  if (csrfError) {
    return csrfError;
  }

  const userId = await getUserIdFromSession();
  if (!userId) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as ProfilePatchBody | null;

  const name = typeof body?.name === "string" ? body.name.trim() : null;
  const phone = typeof body?.phone === "string" ? body.phone.trim() : null;
  const cpfRaw = typeof body?.cpf === "string" ? onlyDigits(body.cpf) : null;

  if (cpfRaw) {
    if (!isValidCPF(cpfRaw)) {
      return NextResponse.json(
        { ok: false, reason: "CPF invalido." },
        { status: 400 },
      );
    }

    let cpfTaken: { id: number } | undefined;

    if (hasPostgresConfig()) {
      const pool = getPostgresPool();
      const result = await pool.query<{ id: number }>(
        `SELECT id
         FROM users
         WHERE cpf = $1 AND id != $2
         LIMIT 1`,
        [cpfRaw, userId],
      );
      cpfTaken = result.rows[0];
    } else {
      const { db } = await import("@/lib/db");
      cpfTaken = db
        .prepare("SELECT id FROM users WHERE cpf = ? AND id != ?")
        .get(cpfRaw, userId) as { id: number } | undefined;
    }

    if (cpfTaken) {
      return NextResponse.json(
        { ok: false, reason: "CPF ja cadastrado em outra conta." },
        { status: 409 },
      );
    }
  }

  const now = new Date().toISOString();

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    await pool.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           phone = COALESCE($2, phone),
           cpf = COALESCE($3, cpf),
           updated_at = $4
       WHERE id = $5`,
      [name || null, phone || null, cpfRaw || null, now, userId],
    );
  } else {
    const { db } = await import("@/lib/db");
    db.prepare(
      `UPDATE users
       SET name = COALESCE(?, name),
           phone = COALESCE(?, phone),
           cpf = COALESCE(?, cpf),
           updated_at = ?
       WHERE id = ?`,
    ).run(name || null, phone || null, cpfRaw || null, now, userId);
  }

  return NextResponse.json({ ok: true });
}
