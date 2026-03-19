import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateCsrfRequest } from "@/lib/csrf";
import { getUserById, updateUserPassword } from "@/lib/authStore";
import { consumeRateLimit, getRequestIp } from "@/lib/rateLimit";
import { verifySessionToken } from "@/lib/sessionToken";
import { validatePassword } from "@/lib/validators";

export const runtime = "nodejs";


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

  const payload = verifySessionToken(token);
  if (!payload) {
    return NextResponse.json(
      { ok: false, reason: "unauthorized" },
      { status: 401 },
    );
  }

  const rateLimit = await consumeRateLimit({
    scope: "auth-change-password",
    key: `${getRequestIp(req)}:${payload.sub}`,
    limit: 8,
    windowMs: 30 * 60 * 1000,
  });

  if (!rateLimit.ok) {
    return NextResponse.json(
      { ok: false, reason: "Muitas tentativas. Aguarde alguns minutos." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)),
        },
      },
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
