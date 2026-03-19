import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateCsrfRequest } from "@/lib/csrf";
import { updateUserPassword } from "@/lib/authStore";
import { consumeRateLimit, getRequestIp } from "@/lib/rateLimit";
import { verifySessionToken } from "@/lib/sessionToken";
import { validatePassword } from "@/lib/validators";

type SetPasswordBody = {
  password?: string;
};

export async function POST(req: Request) {
  const csrfError = validateCsrfRequest(req);
  if (csrfError) {
    return csrfError;
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

  const payload = verifySessionToken(token);
  if (!payload) {
    return NextResponse.json(
      { ok: false, reason: "Sessao invalida." },
      { status: 401 },
    );
  }

  const rateLimit = await consumeRateLimit({
    scope: "auth-set-password",
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

  const hash = await bcrypt.hash(password, 10);
  await updateUserPassword(Number(payload.sub), hash);

  return NextResponse.json({ ok: true });
}
