import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateCsrfRequest } from "@/lib/csrf";
import { getUserById, updateUserPassword } from "@/lib/authStore";
import { getJwtSecret } from "@/lib/runtimeSecrets";
import { validatePassword } from "@/lib/validators";

export const runtime = "nodejs";


type SessionPayload = {
  sub: string | number;
};

type ChangePasswordBody = {
  currentPassword?: string;
  newPassword?: string;
};

type PasswordUserRow = {
  id: number;
  password_hash: string | null;
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

  const cookieStore = await cookies();
  const token = cookieStore.get("pf_session")?.value;

  if (!token) {
    return NextResponse.json(
      { ok: false, reason: "unauthorized" },
      { status: 401 },
    );
  }

  const body = (await req.json().catch(() => null)) as ChangePasswordBody | null;
  const currentPassword = String(body?.currentPassword || "");
  const newPassword = String(body?.newPassword || "");

  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.valid) {
    return NextResponse.json(
      { ok: false, reason: passwordValidation.reason },
      { status: 400 },
    );
  }

  let payload: SessionPayload;
  try {
    payload = jwt.verify(token, jwtSecret) as SessionPayload;
  } catch {
    return NextResponse.json(
      { ok: false, reason: "unauthorized" },
      { status: 401 },
    );
  }

  const user = (await getUserById(payload.sub)) as PasswordUserRow | undefined;

  if (!user) {
    return NextResponse.json(
      { ok: false, reason: "not_found" },
      { status: 404 },
    );
  }

  if (user.password_hash) {
    if (!currentPassword) {
      return NextResponse.json(
        { ok: false, reason: "Informe sua senha atual." },
        { status: 400 },
      );
    }

    const passwordMatches = await bcrypt.compare(
      currentPassword,
      user.password_hash,
    );

    if (!passwordMatches) {
      return NextResponse.json(
        { ok: false, reason: "Senha atual incorreta." },
        { status: 401 },
      );
    }
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await updateUserPassword(user.id, hash);

  return NextResponse.json({ ok: true });
}
