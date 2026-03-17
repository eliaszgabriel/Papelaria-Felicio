"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Container from "@/components/layout/Container";

function VerificarEmailPageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      if (!token) {
        setError("Esse link de verificação não é válido.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => null);
        if (!active) return;

        if (!res.ok) {
          setError(data?.reason || "Não consegui confirmar seu email.");
        } else {
          setNotice("Email confirmado com sucesso. Agora você já pode entrar na sua conta.");
        }
      } catch {
        if (!active) return;
        setError("Não consegui confirmar seu email.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <main>
      <Container>
        <div className="mx-auto max-w-xl pt-10 pb-16">
          <div className="rounded-[30px] border border-white/70 bg-white/88 p-7 shadow-soft">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-felicio-ink/45">
              Ativação da conta
            </div>
            <h1 className="mt-3 text-3xl font-extrabold text-felicio-ink">
              Verificar email
            </h1>

            {loading ? (
              <p className="mt-4 text-sm text-felicio-ink/65">Validando seu link...</p>
            ) : error ? (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {error}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                {notice}
              </div>
            )}

            <Link
              href="/conta"
              className="mt-6 inline-flex text-sm font-semibold text-[#9C3F5B] underline underline-offset-4"
            >
              Ir para minha conta
            </Link>
          </div>
        </div>
      </Container>
    </main>
  );
}

function VerificarEmailFallback() {
  return (
    <main>
      <Container>
        <div className="mx-auto max-w-xl pt-10 pb-16">
          <div className="rounded-[30px] border border-white/70 bg-white/88 p-7 shadow-soft">
            <div className="h-4 w-32 animate-pulse rounded-full bg-black/5" />
            <div className="mt-4 h-9 w-48 animate-pulse rounded-2xl bg-black/5" />
            <div className="mt-6 h-12 animate-pulse rounded-2xl bg-black/5" />
          </div>
        </div>
      </Container>
    </main>
  );
}

export default function VerificarEmailPage() {
  return (
    <Suspense fallback={<VerificarEmailFallback />}>
      <VerificarEmailPageContent />
    </Suspense>
  );
}
