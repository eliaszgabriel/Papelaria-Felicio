import { emitAuthStateChanged } from "@/lib/authEvents";

async function parseApiResponse(res: Response) {
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return res.json().catch(() => ({ ok: false, reason: "Resposta invalida do servidor." }));
  }

  const text = await res.text().catch(() => "");
  return {
    ok: false,
    reason: text.includes("<!DOCTYPE") || text.includes("<html")
      ? "Resposta invalida do servidor. Recarregue a pagina e tente novamente."
      : text || "Resposta invalida do servidor.",
  };
}

export type MeUser = {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  cpf: string | null;
  created_at?: string;
  hasPassword?: boolean;
  emailVerified?: boolean;
};

export type MeResponse =
  | { ok: true; user: null }
  | { ok: true; user: MeUser };

export async function apiRegister(input: {
  email: string;
  password: string;
  name?: string;
  phone?: string;
  cpf?: string;
}) {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseApiResponse(res);
}

export async function apiLogin(input: { email: string; password: string }) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseApiResponse(res);
  if (res.ok && data?.ok) {
    emitAuthStateChanged();
  }
  return data;
}

export async function apiLogout() {
  const res = await fetch("/api/auth/logout", { method: "POST" });
  const data = await parseApiResponse(res);
  if (res.ok && data?.ok) {
    emitAuthStateChanged();
  }
  return data;
}

export async function apiMe(): Promise<MeResponse> {
  const res = await fetch("/api/auth/me", { cache: "no-store" });
  return parseApiResponse(res) as Promise<MeResponse>;
}
