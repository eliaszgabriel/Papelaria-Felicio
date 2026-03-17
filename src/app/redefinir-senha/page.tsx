"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Container from "@/components/layout/Container";

function RedefinirSenhaPageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!token) {
      setError("Esse link de redefinição não é válido.");
      return;
    }

    if (!password || password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas precisam ser iguais.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(
          data?.reason || "Não consegui redefinir sua senha agora.",
        );
        return;
      }

      setNotice("Senha atualizada com sucesso. Agora você já pode entrar na sua conta.");
      setPassword("");
      setConfirmPassword("");
    } catch {
      setError("Não consegui redefinir sua senha agora.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <Container>
        <div className="mx-auto max-w-xl pt-10 pb-16">
          <div className="rounded-[30px] border border-white/70 bg-white/88 p-7 shadow-soft">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-felicio-ink/45">
              Acesso da conta
            </div>
            <h1 className="mt-3 text-3xl font-extrabold text-felicio-ink">
              Redefinir senha
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-felicio-ink/65">
              Crie uma nova senha para voltar a acessar sua conta com tranquilidade.
            </p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <label className="text-xs font-semibold tracking-wide text-felicio-ink/55">
                  NOVA SENHA
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-black/10"
                  placeholder="No mínimo 6 caracteres"
                />
              </div>

              <div>
                <label className="text-xs font-semibold tracking-wide text-felicio-ink/55">
                  CONFIRMAR SENHA
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-black/10"
                  placeholder="Repita a nova senha"
                />
              </div>

              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  {error}
                </div>
              )}

              {notice && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  {notice}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-2xl bg-[#F3A6B6] px-5 py-3 font-semibold text-white shadow-[0_12px_32px_rgba(243,166,182,0.45)] transition hover:bg-[#EC93A6] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Atualizando..." : "Salvar nova senha"}
              </button>
            </form>

            <Link
              href="/conta"
              className="mt-5 inline-flex text-sm font-semibold text-[#9C3F5B] underline underline-offset-4"
            >
              Voltar para a conta
            </Link>
          </div>
        </div>
      </Container>
    </main>
  );
}

function RedefinirSenhaFallback() {
  return (
    <main>
      <Container>
        <div className="mx-auto max-w-xl pt-10 pb-16">
          <div className="rounded-[30px] border border-white/70 bg-white/88 p-7 shadow-soft">
            <div className="h-4 w-28 animate-pulse rounded-full bg-black/5" />
            <div className="mt-4 h-9 w-52 animate-pulse rounded-2xl bg-black/5" />
            <div className="mt-6 space-y-4">
              <div className="h-12 animate-pulse rounded-2xl bg-black/5" />
              <div className="h-12 animate-pulse rounded-2xl bg-black/5" />
              <div className="h-12 animate-pulse rounded-2xl bg-black/5" />
            </div>
          </div>
        </div>
      </Container>
    </main>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <Suspense fallback={<RedefinirSenhaFallback />}>
      <RedefinirSenhaPageContent />
    </Suspense>
  );
}
