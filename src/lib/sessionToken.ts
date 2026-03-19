import jwt from "jsonwebtoken";
import { getJwtSecret, requireJwtSecret } from "@/lib/runtimeSecrets";
import { JWT_AUDIENCE, JWT_ISSUER } from "@/lib/tokenClaims";

export type SessionTokenPayload = {
  sub: string;
  email: string;
  type: "user_session";
};

function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

export function createSessionToken(userId: string | number, email: string) {
  const payload: SessionTokenPayload = {
    sub: String(userId),
    email: normalizeEmail(email),
    type: "user_session",
  };

  return jwt.sign(payload, requireJwtSecret(), {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE.session,
    expiresIn: "30d",
  });
}

export function verifySessionToken(token: string | null | undefined) {
  const secret = getJwtSecret();
  if (!secret || !token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, secret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE.session,
    }) as Partial<SessionTokenPayload>;

    if (payload.type !== "user_session" || !payload.sub || !payload.email) {
      return null;
    }

    return {
      sub: String(payload.sub),
      email: normalizeEmail(payload.email),
      type: "user_session" as const,
    };
  } catch {
    return null;
  }
}
