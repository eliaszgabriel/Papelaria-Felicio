export type PushinPayCashInResponse = {
  id: string;
  qr_code: string;
  qr_code_base64?: string;
  status: "created" | "paid" | "canceled" | "expired";
  value: number; // centavos
  webhook_url?: string | null;
  end_to_end_id?: string | null;
  payer_name?: string | null;
  payer_national_registration?: string | null;
};

export async function pushinpayCreatePixCashIn(
  valueInCents: number,
  webhookUrl: string,
) {
  const token = process.env.PUSHINPAY_TOKEN;
  if (!token) throw new Error("Missing PUSHINPAY_TOKEN");

  const base = "https://api.pushinpay.com.br/api";

  // Timeout de segurança: aborta se a API travar por mais de 10s
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  let res: Response;
  try {
    res = await fetch(`${base}/pix/cashIn`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        value: valueInCents,
        webhook_url: webhookUrl,
      }),
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`PushinPay cashIn failed: ${res.status} ${txt}`);
  }

  const data = (await res.json()) as PushinPayCashInResponse;

  // Validações de segurança
  if (!data?.id) {
    throw new Error("PushinPay response missing transaction id");
  }
  if (!data?.qr_code) {
    throw new Error("PushinPay response missing qr_code");
  }
  if (!data?.value) {
    throw new Error("PushinPay response missing value");
  }
  if (!data?.status) {
    throw new Error("PushinPay response missing status");
  }

  return data;
}
export type PushinPayTransaction = {
  id: string;
  status: "created" | "paid" | "canceled" | "expired";
  value: number; // centavos
  end_to_end_id?: string | null;
};

export async function pushinpayGetTransaction(id: string) {
  const token = process.env.PUSHINPAY_TOKEN;
  if (!token) throw new Error("Missing PUSHINPAY_TOKEN");

  const baseApi = "https://api.pushinpay.com.br/api";
  const baseNoApi = "https://api.pushinpay.com.br";

  const tryFetch = async (url: string) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      return { res, data };
    } finally {
      clearTimeout(timeout);
    }
  };

  // 1) Tenta formato /api/transactions
  let r = await tryFetch(`${baseApi}/transactions/${encodeURIComponent(id)}`);
  if (r.res.ok && r.data?.id) return r.data;

  // 2) Fallback /transaction (sem /api)
  r = await tryFetch(`${baseNoApi}/transaction/${encodeURIComponent(id)}`);
  if (r.res.ok && r.data?.id) return r.data;

  throw new Error(
    `PushinPay getTransaction failed: ${r.res.status} ${JSON.stringify(r.data)}`,
  );
}
