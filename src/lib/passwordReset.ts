import crypto from "crypto";
import jwt from "jsonwebtoken";
import {
  getPasswordResetSecret,
  requirePasswordResetSecret,
} from "@/lib/runtimeSecrets";

type ResetPayload = {
  email: string;
  hash: string;
  purpose: "password-reset";
};

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
  const payload: ResetPayload = {
    email: String(email || "").trim().toLowerCase(),
    hash: hashPasswordFingerprint(passwordHash),
    purpose: "password-reset",
  };

  return jwt.sign(payload, requirePasswordResetSecret(), { expiresIn: "1h" });
}

export function verifyPasswordResetToken(token: string) {
  const secret = getPasswordResetSecret();
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
