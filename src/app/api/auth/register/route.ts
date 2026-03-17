import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createUser, getUserByCpf, getUserByEmail } from "@/lib/authStore";
import { validateCsrfRequest } from "@/lib/csrf";
import { isValidCPF, onlyDigits } from "@/lib/validators";
import { consumeRateLimit, getRequestIp } from "@/lib/rateLimit";
import { sendEmail } from "@/lib/email";
import { createEmailVerificationToken } from "@/lib/emailVerification";

export async function POST(req: Request) {
  const csrfError = validateCsrfRequest(req);
  if (csrfError) {
    return csrfError;
  }

  const rateLimit = await consumeRateLimit({
    scope: "auth-register",
    key: getRequestIp(req),
    limit: 6,
    windowMs: 30 * 60 * 1000,
  });

  if (!rateLimit.ok) {
    return NextResponse.json(
      { ok: false, reason: "Muitas tentativas de cadastro. Tente novamente mais tarde." },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);

  const email = String(body?.email || "")
    .trim()
    .toLowerCase();
  const password = String(body?.password || "");
  const name = body?.name ? String(body.name).trim() : null;
  const phone = body?.phone ? String(body.phone).trim() : null;
  const cpfRaw = body?.cpf ? onlyDigits(String(body.cpf)) : null;

  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { ok: false, reason: "Email inválido." },
      { status: 400 },
    );
  }

  if (!password || password.length < 6) {
    return NextResponse.json(
      { ok: false, reason: "Senha precisa ter 6+ caracteres." },
      { status: 400 },
    );
  }

  if (cpfRaw && !isValidCPF(cpfRaw)) {
    return NextResponse.json(
      { ok: false, reason: "CPF inválido." },
      { status: 400 },
    );
  }

  const existing = await getUserByEmail(email);
  if (existing) {
    return NextResponse.json(
      { ok: false, reason: "Email já cadastrado." },
      { status: 409 },
    );
  }

  if (cpfRaw) {
    const cpfTaken = await getUserByCpf(cpfRaw);
    if (cpfTaken) {
      return NextResponse.json(
        { ok: false, reason: "CPF já cadastrado." },
        { status: 409 },
      );
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = await createUser({
    email,
    passwordHash,
    name,
    phone,
    cpf: cpfRaw || null,
    emailVerified: 0,
  });

  const verificationToken = createEmailVerificationToken(email);
  const siteUrl = process.env.SITE_URL || new URL(req.url).origin;
  const verifyUrl = `${siteUrl}/verificar-email?token=${encodeURIComponent(verificationToken)}`;

  let emailDeliveryFailed = false;
  try {
    await sendEmail({
      to: email,
      subject: "Confirme seu email - Papelaria Felicio",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6">
          <h2>Bem-vinda a Papelaria Felicio</h2>
          <p>${name || "Oi"}, sua conta foi criada com sucesso.</p>
          <p>Agora só falta confirmar seu email:</p>
          <p><a href="${verifyUrl}">${verifyUrl}</a></p>
          <p>Esse link expira em 24 horas.</p>
          <hr />
          <p style="color:#666;font-size:12px">Papelaria Felicio</p>
        </div>
      `,
    });
  } catch {
    emailDeliveryFailed = true;
  }

  return NextResponse.json({
    ok: true,
    requiresVerification: true,
    emailDeliveryFailed,
    user: {
      id: userId,
      email,
      name,
      phone,
      cpf: cpfRaw,
    },
  });
}
