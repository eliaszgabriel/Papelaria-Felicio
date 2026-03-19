import jwt from "jsonwebtoken";
import {
  getEmailVerificationSecret,
  requireEmailVerificationSecret,
} from "@/lib/runtimeSecrets";
import { JWT_AUDIENCE, JWT_ISSUER } from "@/lib/tokenClaims";

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
    {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE.emailVerification,
      expiresIn: "24h",
    },
  );
}

export function verifyEmailVerificationToken(token: string) {
  const secret = getEmailVerificationSecret();
  if (!secret || !token) return null;

  try {
    const payload = jwt.verify(token, secret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE.emailVerification,
    }) as VerificationPayload;
    if (payload.purpose !== "email-verification") return null;
    return payload;
  } catch {
    return null;
  }
}
