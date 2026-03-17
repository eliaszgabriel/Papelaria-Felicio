import { NextResponse } from "next/server";
import { markUserEmailVerified } from "@/lib/authStore";
import { verifyEmailVerificationToken } from "@/lib/emailVerification";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = String(body?.token || "");

  const payload = verifyEmailVerificationToken(token);
  if (!payload?.email) {
    return NextResponse.json(
      { ok: false, reason: "Link inválido ou expirado." },
      { status: 400 },
    );
  }

  await markUserEmailVerified(payload.email);

  return NextResponse.json({ ok: true });
}
