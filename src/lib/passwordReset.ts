import crypto from "crypto";
import jwt from "jsonwebtoken";

type ResetPayload = {
  email: string;
  hash: string;
  purpose: "password-reset";
};

function getResetSecret() {
  return (
    process.env.PASSWORD_RESET_SECRET ||
    process.env.JWT_SECRET ||
    (process.env.NODE_ENV !== "production" ? "dev-secret-troque-isso" : "")
  );
}

function hashPasswordFingerprint(passwordHash: string | null | undefined) {
  return crypto
    .createHash("sha256")
    .update(String(passwordHash || ""))
    .digest("hex");
}

export function createPasswordResetToken(
  email: string,
  passwordHash: string | null | undefined,
) {
  const secret = getResetSecret();
  if (!secret) {
    throw new Error("password_reset_secret_not_configured");
  }

  const payload: ResetPayload = {
    email: String(email || "").trim().toLowerCase(),
    hash: hashPasswordFingerprint(passwordHash),
    purpose: "password-reset",
  };

  return jwt.sign(payload, secret, { expiresIn: "1h" });
}

export function verifyPasswordResetToken(token: string) {
  const secret = getResetSecret();
  if (!secret || !token) return null;

  try {
    const payload = jwt.verify(token, secret) as ResetPayload;
    if (payload.purpose !== "password-reset") return null;
    return payload;
  } catch {
    return null;
  }
}

export function matchesPasswordResetFingerprint(
  payloadHash: string,
  currentPasswordHash: string | null | undefined,
) {
  return payloadHash === hashPasswordFingerprint(currentPasswordHash);
}
