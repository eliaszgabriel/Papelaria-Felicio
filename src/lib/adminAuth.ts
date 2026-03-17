import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const ADMIN_SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET ||
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV !== "production" ? "dev-secret-troque-isso" : "");

export const ADMIN_COOKIE_NAME = "felicio_admin";

type AdminPayload = {
  role: "admin";
};

export function createAdminToken() {
  if (!ADMIN_SESSION_SECRET) {
    throw new Error("admin_session_secret_not_configured");
  }

  return jwt.sign({ role: "admin" satisfies AdminPayload["role"] }, ADMIN_SESSION_SECRET, {
    expiresIn: "8h",
  });
}

export function verifyAdminToken(token: string | undefined | null) {
  if (!token) return false;

  try {
    const payload = jwt.verify(token, ADMIN_SESSION_SECRET) as Partial<AdminPayload>;
    return payload.role === "admin";
  } catch {
    return false;
  }
}

export async function isAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminToken(token);
}
