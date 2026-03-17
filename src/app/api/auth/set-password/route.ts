import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateCsrfRequest } from "@/lib/csrf";
import { updateUserPassword } from "@/lib/authStore";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV !== "production" ? "dev-secret-troque-isso" : "");

type SessionPayload = {
  sub: string | number;
};

type SetPasswordBody = {
  password?: string;
};

export async function POST(req: Request) {
  const csrfError = validateCsrfRequest(req);
  if (csrfError) {
    return csrfError;
  }

  if (!JWT_SECRET) {
    return NextResponse.json(
      { ok: false, reason: "server_not_configured" },
      { status: 500 },
    );
  }

  const body = (await req.json().catch(() => null)) as SetPasswordBody | null;
  const password = String(body?.password || "");

  if (!password || password.length < 6) {
    return NextResponse.json(
      { ok: false, reason: "Senha deve ter 6+ caracteres." },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("pf_session")?.value;
  if (!token) {
    return NextResponse.json(
      { ok: false, reason: "Nao autenticado." },
      { status: 401 },
    );
  }

  let payload: SessionPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch {
    return NextResponse.json(
      { ok: false, reason: "Sessao invalida." },
      { status: 401 },
    );
  }

  const hash = await bcrypt.hash(password, 10);
  await updateUserPassword(Number(payload.sub), hash);

  return NextResponse.json({ ok: true });
}
