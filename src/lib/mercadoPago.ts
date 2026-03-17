const MERCADOPAGO_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || "";

export type MercadoPagoPreferenceItem = {
  title: string;
  quantity: number;
  unit_price: number;
  currency_id?: "BRL";
};

export type MercadoPagoPreferenceInput = {
  orderId: string;
  payerEmail?: string;
  items: MercadoPagoPreferenceItem[];
  notificationUrl?: string;
  successUrl: string;
  pendingUrl: string;
  failureUrl: string;
};

type MercadoPagoPreferenceResponse = {
  id: string;
  init_point?: string;
  sandbox_init_point?: string;
};

type MercadoPagoPaymentResponse = {
  id: number | string;
  status?: string | null;
  external_reference?: string | null;
  metadata?: Record<string, unknown> | null;
  transaction_amount?: number | null;
  installments?: number | null;
  payment_method_id?: string | null;
};

function isPreferenceResponse(
  value: unknown,
): value is MercadoPagoPreferenceResponse {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      typeof (value as { id?: unknown }).id === "string",
  );
}

function isPaymentResponse(value: unknown): value is MercadoPagoPaymentResponse {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      (typeof (value as { id?: unknown }).id === "string" ||
        typeof (value as { id?: unknown }).id === "number"),
  );
}

function ensureMercadoPagoToken() {
  if (!MERCADOPAGO_ACCESS_TOKEN) {
    throw new Error("mercadopago_not_configured");
  }
}

export async function createMercadoPagoPreference(
  input: MercadoPagoPreferenceInput,
) {
  ensureMercadoPagoToken();

  const preferenceBody: Record<string, unknown> = {
    items: input.items.map((item) => ({
      ...item,
      currency_id: "BRL",
    })),
    payer: input.payerEmail ? { email: input.payerEmail } : undefined,
    external_reference: input.orderId,
    notification_url: input.notificationUrl,
    back_urls: {
      success: input.successUrl,
      pending: input.pendingUrl,
      failure: input.failureUrl,
    },
  };

  if (input.successUrl.startsWith("https://")) {
    preferenceBody.auto_return = "approved";
  }

  const response = await fetch(
    "https://api.mercadopago.com/checkout/preferences",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `felicio-pref-${input.orderId}`,
      },
      body: JSON.stringify(preferenceBody),
    },
  );

  const data = (await response.json().catch(() => null)) as
    | MercadoPagoPreferenceResponse
    | { message?: string }
    | null;

  if (!response.ok || !isPreferenceResponse(data)) {
    throw new Error(
      `mercadopago_preference_error:${response.status}:${data && "message" in data ? data.message || "unknown" : "unknown"}`,
    );
  }

  return {
    id: data.id,
    checkoutUrl: data.init_point || data.sandbox_init_point || "",
  };
}

export async function getMercadoPagoPayment(paymentId: string | number) {
  ensureMercadoPagoToken();

  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/${encodeURIComponent(String(paymentId))}`,
    {
      headers: {
        Authorization: `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    },
  );

  const data = (await response.json().catch(() => null)) as
    | MercadoPagoPaymentResponse
    | { message?: string }
    | null;

  if (!response.ok || !isPaymentResponse(data)) {
    throw new Error(
      `mercadopago_payment_error:${response.status}:${data && "message" in data ? data.message || "unknown" : "unknown"}`,
    );
  }

  return data;
}
