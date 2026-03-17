import { NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/authStore";
import { sendEmail } from "@/lib/email";
import { validateCsrfRequest } from "@/lib/csrf";
import { consumeRateLimit, getRequestIp } from "@/lib/rateLimit";
import { createEmailVerificationToken } from "@/lib/emailVerification";

type UserRow = {
  email: string;
  name: string | null;
  email_verified: number | null;
};

export async function POST(req: Request) {
  const csrfError = validateCsrfRequest(req);
  if (csrfError) return csrfError;

  const body = await req.json().catch(() => null);
  const email = String(body?.email || "")
    .trim()
    .toLowerCase();

  const rateLimit = await consumeRateLimit({
    scope: "auth-email-verification",
    key: `${getRequestIp(req)}:${email || "sem-email"}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });

  if (!rateLimit.ok) {
    return NextResponse.json(
      { ok: false, reason: "Muitas tentativas. Aguarde antes de pedir outro link." },
      { status: 429 },
    );
  }

  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { ok: false, reason: "Informe um email válido." },
      { status: 400 },
    );
  }

  const user = (await getUserByEmail(email)) as UserRow | undefined;

  if (user && Number(user.email_verified ?? 0) !== 1) {
    const siteUrl = process.env.SITE_URL || new URL(req.url).origin;
    const token = createEmailVerificationToken(user.email);
    const verifyUrl = `${siteUrl}/verificar-email?token=${encodeURIComponent(token)}`;

    await sendEmail({
      to: user.email,
      subject: "Confirme seu email - Papelaria Felicio",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6">
          <h2>Confirmação de email</h2>
          <p>${user.name?.trim() || "Oi"}, falta só confirmar seu email para ativar sua conta.</p>
          <p>Use o link abaixo para concluir:</p>
          <p><a href="${verifyUrl}">${verifyUrl}</a></p>
          <p>Esse link expira em 24 horas.</p>
          <hr />
          <p style="color:#666;font-size:12px">Papelaria Felicio</p>
        </div>
      `,
    });
  }

  return NextResponse.json({ ok: true });
}
