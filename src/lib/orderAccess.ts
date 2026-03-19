import jwt from "jsonwebtoken";
import {
  getOrderAccessSecret,
  requireOrderAccessSecret,
} from "@/lib/runtimeSecrets";


type OrderLookupPayload = {
  type: "order_lookup";
  email: string;
  orderId: string;
};

function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

function normalizeOrderId(orderId: string) {
  return String(orderId || "").trim();
}

export function createOrderLookupToken(email: string, orderId: string) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedOrderId = normalizeOrderId(orderId);
  return jwt.sign(
    {
      type: "order_lookup",
      email: normalizedEmail satisfies OrderLookupPayload["email"],
      orderId: normalizedOrderId satisfies OrderLookupPayload["orderId"],
    },
    requireOrderAccessSecret(),
    { expiresIn: "14d" },
  );
}

export function verifyOrderLookupToken(token: string | null | undefined) {
  if (!token) return null;

  try {
    const payload = jwt.verify(token, getOrderAccessSecret()) as Partial<OrderLookupPayload>;
    if (payload.type !== "order_lookup" || !payload.email || !payload.orderId) {
      return null;
    }
    return {
      email: normalizeEmail(payload.email),
      orderId: normalizeOrderId(payload.orderId),
    };
  } catch {
    return null;
  }
}
