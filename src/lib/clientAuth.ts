import { emitAuthStateChanged } from "@/lib/authEvents";

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
  return res.json();
}

export async function apiLogin(input: { email: string; password: string }) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (res.ok && data?.ok) {
    emitAuthStateChanged();
  }
  return data;
}

export async function apiLogout() {
  const res = await fetch("/api/auth/logout", { method: "POST" });
  const data = await res.json();
  if (res.ok && data?.ok) {
    emitAuthStateChanged();
  }
  return data;
}

export async function apiMe(): Promise<MeResponse> {
  const res = await fetch("/api/auth/me", { cache: "no-store" });
  return res.json();
}
