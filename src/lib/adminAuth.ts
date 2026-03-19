import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import {
  requireAdminSessionSecret,
} from "@/lib/runtimeSecrets";
import { JWT_AUDIENCE, JWT_ISSUER } from "@/lib/tokenClaims";


export const ADMIN_COOKIE_NAME = "felicio_admin";

type AdminPayload = {
  role: "admin";
  type: "admin_session";
};

export function createAdminToken() {
  return jwt.sign(
    {
      role: "admin" satisfies AdminPayload["role"],
      type: "admin_session" satisfies AdminPayload["type"],
    },
    requireAdminSessionSecret(),
    {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE.admin,
      expiresIn: "8h",
    },
  );
}

export function verifyAdminToken(token: string | undefined | null) {
  if (!token) return false;

  try {
    const payload = jwt.verify(token, requireAdminSessionSecret(), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE.admin,
    }) as Partial<AdminPayload>;
    return payload.role === "admin" && payload.type === "admin_session";
  } catch {
    return false;
  }
}

export async function isAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminToken(token);
}
