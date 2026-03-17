import jwt from "jsonwebtoken";

type VerificationPayload = {
  email: string;
  purpose: "email-verification";
};

function getVerificationSecret() {
  return (
    process.env.EMAIL_VERIFICATION_SECRET ||
    process.env.JWT_SECRET ||
    (process.env.NODE_ENV !== "production" ? "dev-secret-troque-isso" : "")
  );
}

export function createEmailVerificationToken(email: string) {
  const secret = getVerificationSecret();
  if (!secret) {
    throw new Error("email_verification_secret_not_configured");
  }

  return jwt.sign(
    {
      email: String(email || "").trim().toLowerCase(),
      purpose: "email-verification",
    } satisfies VerificationPayload,
    secret,
    { expiresIn: "24h" },
  );
}

export function verifyEmailVerificationToken(token: string) {
  const secret = getVerificationSecret();
  if (!secret || !token) return null;

  try {
    const payload = jwt.verify(token, secret) as VerificationPayload;
    if (payload.purpose !== "email-verification") return null;
    return payload;
  } catch {
    return null;
  }
}
