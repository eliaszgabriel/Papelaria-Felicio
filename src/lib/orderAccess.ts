import jwt from "jsonwebtoken";
import {
  getOrderAccessSecret,
  requireOrderAccessSecret,
} from "@/lib/runtimeSecrets";


type OrderLookupPayload = {
  type: "order_lookup";
  email: string;
};

function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

export function createOrderLookupToken(email: string) {
  const normalizedEmail = normalizeEmail(email);
  return jwt.sign(
    { type: "order_lookup", email: normalizedEmail satisfies OrderLookupPayload["email"] },
    requireOrderAccessSecret(),
    { expiresIn: "30d" },
  );
}

export function verifyOrderLookupToken(token: string | null | undefined) {
  if (!token) return null;

  try {
    const payload = jwt.verify(token, getOrderAccessSecret()) as Partial<OrderLookupPayload>;
    if (payload.type !== "order_lookup" || !payload.email) return null;
    return { email: normalizeEmail(payload.email) };
  } catch {
    return null;
  }
}
