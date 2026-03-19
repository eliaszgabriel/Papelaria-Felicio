import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { ADMIN_COOKIE_NAME, createAdminToken } from "@/lib/adminAuth";
import { validateCsrfRequest } from "@/lib/csrf";
import { consumeRateLimit, getRequestIp } from "@/lib/rateLimit";
import {
  getAdminSessionSecret,
} from "@/lib/runtimeSecrets";

export const runtime = "nodejs";


export async function POST(req: Request) {
  const csrfError = validateCsrfRequest(req);
  if (csrfError) {
    return csrfError;
  }

  const { key, username, password } = await req.json().catch(() => ({
    key: "",
    username: "",
    password: "",
  }));
  const adminUsername = String(process.env.ADMIN_USERNAME || "").trim();
  const adminPasswordHash = String(process.env.ADMIN_PASSWORD_HASH || "").trim();
  const adminKey =
    process.env.NODE_ENV !== "production"
      ? String(process.env.ADMIN_KEY || "").trim()
      : "";
  const adminSessionSecret = getAdminSessionSecret();
  const hasUserPasswordAuth = Boolean(adminUsername && adminPasswordHash);
  const hasLegacyKey = Boolean(adminKey);

  if ((!hasUserPasswordAuth && !hasLegacyKey) || !adminSessionSecret) {
    return NextResponse.json(
      { ok: false, error: "Configuracao de admin incompleta" },
      { status: 500 },
    );
  }

  const rateLimit = await consumeRateLimit({
    scope: "admin-login",
    key: `${getRequestIp(req)}:${String(username || "").trim().toLowerCase() || "sem-usuario"}`,
    limit: 5,
    windowMs: 30 * 60 * 1000,
  });

  if (!rateLimit.ok) {
    return NextResponse.json(
      { ok: false, error: "Muitas tentativas. Tente novamente em alguns minutos." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)),
        },
      },
    );
  }

  let isValid = false;

  if (hasUserPasswordAuth) {
    const normalizedUsername = String(username || "").trim();
    const rawPassword = String(password || "");

    if (!normalizedUsername || !rawPassword) {
      return NextResponse.json(
        { ok: false, error: "Usuario e senha sao obrigatorios." },
        { status: 400 },
      );
    }

    isValid =
      normalizedUsername === adminUsername &&
      (await bcrypt.compare(rawPassword, adminPasswordHash));
  } else {
    isValid = String(key || "").trim() === adminKey;
  }

  if (!isValid) {
    return NextResponse.json(
      { ok: false, error: hasUserPasswordAuth ? "Credenciais invalidas" : "Senha invalida" },
      { status: 401 },
    );
  }

  const res = NextResponse.json({ ok: true });
  const token = createAdminToken();

  res.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return res;
}
