"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Container from "@/components/layout/Container";

export default function AdminLoginClient() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setError(data?.error || "Senha invalida.");
        setLoading(false);
        return;
      }

      router.push("/admin/pedidos");
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <Container>
        <div className="max-w-xl pt-10 pb-16">
          <h1 className="text-2xl font-extrabold text-felicio-ink/80 sm:text-3xl">
            Admin - Login
          </h1>
          <p className="mt-2 text-sm text-felicio-ink/60">
            Entre com usuario e senha do admin para acessar os pedidos e produtos.
          </p>

          <div className="mt-6 rounded-3xl border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Usuario do admin"
              type="text"
              className="w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-felicio-ink/80 outline-none"
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha do admin"
              type="password"
              className="mt-3 w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-felicio-ink/80 outline-none"
            />

            {error && (
              <p className="mt-3 text-sm text-felicio-ink/70">{error}</p>
            )}

            <button
              onClick={submit}
              disabled={loading || !username.trim() || !password.trim()}
              className="mt-4 w-full rounded-2xl bg-gradient-to-r from-felicio-pink/70 to-felicio-lilac/90 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </div>
        </div>
      </Container>
    </main>
  );
}
