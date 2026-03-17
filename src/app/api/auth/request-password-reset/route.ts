import { NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/authStore";
import { sendEmail } from "@/lib/email";
import { validateCsrfRequest } from "@/lib/csrf";
import { consumeRateLimit, getRequestIp } from "@/lib/rateLimit";
import { createPasswordResetToken } from "@/lib/passwordReset";

type UserRow = {
  email: string;
  name: string | null;
  password_hash: string | null;
};

export async function POST(req: Request) {
  const csrfError = validateCsrfRequest(req);
  if (csrfError) {
    return csrfError;
  }

  const body = await req.json().catch(() => null);
  const email = String(body?.email || "")
    .trim()
    .toLowerCase();

  const rateLimit = await consumeRateLimit({
    scope: "auth-reset-request",
    key: `${getRequestIp(req)}:${email || "sem-email"}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });

  if (!rateLimit.ok) {
    return NextResponse.json(
      {
        ok: false,
        reason: "Muitas tentativas. Aguarde um pouco antes de pedir outro link.",
      },
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

  if (user) {
    const siteUrl = process.env.SITE_URL || new URL(req.url).origin;
    const token = createPasswordResetToken(user.email, user.password_hash);
    const resetUrl = `${siteUrl}/redefinir-senha?token=${encodeURIComponent(token)}`;
    const customerName = user.name?.trim() || "Oi";

    await sendEmail({
      to: user.email,
      subject: "Redefina sua senha - Papelaria Felicio",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6">
          <h2>Redefinição de senha</h2>
          <p>${customerName}, recebemos um pedido para redefinir a senha da sua conta.</p>
          <p>Para criar uma nova senha, use o link abaixo:</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p>Esse link expira em 1 hora.</p>
          <p>Se você não pediu essa alteração, pode ignorar este email.</p>
          <hr />
          <p style="color:#666;font-size:12px">Papelaria Felicio</p>
        </div>
      `,
    });
  }

  return NextResponse.json({ ok: true });
}
