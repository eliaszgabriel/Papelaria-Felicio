import jwt from "jsonwebtoken";

const ORDER_ACCESS_SECRET =
  process.env.ORDER_ACCESS_SECRET ||
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV !== "production" ? "dev-secret-troque-isso" : "");

type OrderLookupPayload = {
  type: "order_lookup";
  email: string;
};

function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

export function createOrderLookupToken(email: string) {
  if (!ORDER_ACCESS_SECRET) {
    throw new Error("order_access_secret_not_configured");
  }

  const normalizedEmail = normalizeEmail(email);
  return jwt.sign(
    { type: "order_lookup", email: normalizedEmail satisfies OrderLookupPayload["email"] },
    ORDER_ACCESS_SECRET,
    { expiresIn: "30d" },
  );
}

export function verifyOrderLookupToken(token: string | null | undefined) {
  if (!token) return null;

  try {
    const payload = jwt.verify(token, ORDER_ACCESS_SECRET) as Partial<OrderLookupPayload>;
    if (payload.type !== "order_lookup" || !payload.email) return null;
    return { email: normalizeEmail(payload.email) };
  } catch {
    return null;
  }
}
