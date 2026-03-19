import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import {
  requireAdminSessionSecret,
} from "@/lib/runtimeSecrets";


export const ADMIN_COOKIE_NAME = "felicio_admin";

type AdminPayload = {
  role: "admin";
};

export function createAdminToken() {
  return jwt.sign({ role: "admin" satisfies AdminPayload["role"] }, requireAdminSessionSecret(), {
    expiresIn: "8h",
  });
}

export function verifyAdminToken(token: string | undefined | null) {
  if (!token) return false;

  try {
    const payload = jwt.verify(token, requireAdminSessionSecret()) as Partial<AdminPayload>;
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
