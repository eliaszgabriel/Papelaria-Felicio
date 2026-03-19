import jwt from "jsonwebtoken";
import {
  getEmailVerificationSecret,
  requireEmailVerificationSecret,
} from "@/lib/runtimeSecrets";

type VerificationPayload = {
  email: string;
  purpose: "email-verification";
};


export function createEmailVerificationToken(email: string) {
  return jwt.sign(
    {
      email: String(email || "").trim().toLowerCase(),
      purpose: "email-verification",
    } satisfies VerificationPayload,
    requireEmailVerificationSecret(),
    { expiresIn: "24h" },
  );
}

export function verifyEmailVerificationToken(token: string) {
  const secret = getEmailVerificationSecret();
  if (!secret || !token) return null;

  try {
    const payload = jwt.verify(token, secret) as VerificationPayload;
    if (payload.purpose !== "email-verification") return null;
    return payload;
  } catch {
    return null;
  }
}
