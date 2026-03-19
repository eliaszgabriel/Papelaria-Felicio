import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateCsrfRequest } from "@/lib/csrf";
import { updateUserPassword } from "@/lib/authStore";
import { getJwtSecret } from "@/lib/runtimeSecrets";
import { validatePassword } from "@/lib/validators";


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

  const jwtSecret = getJwtSecret();
  if (!jwtSecret) {
    return NextResponse.json(
      { ok: false, reason: "server_not_configured" },
      { status: 500 },
    );
  }

  const body = (await req.json().catch(() => null)) as SetPasswordBody | null;
  const password = String(body?.password || "");

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return NextResponse.json(
      { ok: false, reason: passwordValidation.reason },
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
    payload = jwt.verify(token, jwtSecret) as SessionPayload;
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
