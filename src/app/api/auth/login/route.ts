import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { validateCsrfRequest } from "@/lib/csrf";
import { getUserByEmail } from "@/lib/authStore";
import { consumeRateLimit, getRequestIp } from "@/lib/rateLimit";
import { getUserSessionCookieOptions } from "@/lib/secureCookies";
import { createSessionToken } from "@/lib/sessionToken";

type LoginBody = {
  email?: string;
  password?: string;
};

type UserRow = {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  password_hash: string | null;
  email_verified: number | null;
};

export async function POST(req: Request) {
  const csrfError = validateCsrfRequest(req);
  if (csrfError) {
    return csrfError;
  }

  const body = (await req.json().catch(() => null)) as LoginBody | null;

  const email = String(body?.email || "")
    .trim()
    .toLowerCase();
  const password = String(body?.password || "");

  const rateLimit = await consumeRateLimit({
    scope: "auth-login",
    key: `${getRequestIp(req)}:${email || "sem-email"}`,
    limit: 10,
    windowMs: 15 * 60 * 1000,
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

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, reason: "Email e senha sao obrigatorios." },
      { status: 400 },
    );
  }

  const user = (await getUserByEmail(email)) as UserRow | undefined;

  if (!user || !user.password_hash) {
    return NextResponse.json(
      { ok: false, reason: "Credenciais invalidas." },
      { status: 401 },
    );
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    return NextResponse.json(
      { ok: false, reason: "Credenciais invalidas." },
      { status: 401 },
    );
  }

  if (Number(user.email_verified ?? 0) !== 1) {
    return NextResponse.json(
      {
        ok: false,
        reason: "Confirme seu email antes de entrar. Se precisar, peca um novo link.",
        requiresEmailVerification: true,
      },
      { status: 403 },
    );
  }

  const token = createSessionToken(user.id, user.email);

  const response = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
    },
  });

  response.cookies.set("pf_session", token, {
    ...getUserSessionCookieOptions(),
  });

  return response;
}
