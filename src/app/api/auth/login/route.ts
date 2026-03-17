import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import { validateCsrfRequest } from "@/lib/csrf";
import { getUserByEmail } from "@/lib/authStore";
import { consumeRateLimit, getRequestIp } from "@/lib/rateLimit";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV !== "production" ? "dev-secret-troque-isso" : "");

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

  if (!JWT_SECRET) {
    return NextResponse.json(
      { ok: false, reason: "server_not_configured" },
      { status: 500 },
    );
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
        reason: "Confirme seu email antes de entrar. Se precisar, peça um novo link.",
        requiresEmailVerification: true,
      },
      { status: 403 },
    );
  }

  const token = jwt.sign(
    { sub: String(user.id), email: user.email },
    JWT_SECRET,
    { expiresIn: "30d" },
  );

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
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
