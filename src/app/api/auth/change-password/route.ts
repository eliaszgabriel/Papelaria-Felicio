import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateCsrfRequest } from "@/lib/csrf";
import { getUserById, updateUserPassword } from "@/lib/authStore";

export const runtime = "nodejs";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV !== "production" ? "dev-secret-troque-isso" : "");

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

  if (!JWT_SECRET) {
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

  if (!newPassword || newPassword.length < 6) {
    return NextResponse.json(
      { ok: false, reason: "A nova senha deve ter no minimo 6 caracteres." },
      { status: 400 },
    );
  }

  let payload: SessionPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET) as SessionPayload;
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
