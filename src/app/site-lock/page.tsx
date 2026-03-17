import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acesso restrito | Papelaria Felicio",
  robots: {
    index: false,
    follow: false,
  },
};

type Props = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

export default async function SiteLockPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = params.next && params.next.startsWith("/") ? params.next : "/";
  const hasError = params.error === "1";

  return (
    <main className="min-h-[76vh] py-16">
      <div className="mx-auto max-w-xl px-4">
        <div className="rounded-[32px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,245,248,0.9))] p-8 shadow-[0_24px_70px_rgba(0,0,0,0.10)] backdrop-blur-md">
          <div className="inline-flex rounded-full border border-felicio-pink/18 bg-white px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-felicio-ink/60">
            Homologacao privada
          </div>

          <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-felicio-ink">
            Acesso temporariamente protegido
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-felicio-ink/65">
            O site esta publicado para testes internos. Digite a senha de homologacao
            para continuar e validar os fluxos em ambiente real.
          </p>

          <form action="/api/site-lock" method="post" className="mt-7 space-y-4">
            <input type="hidden" name="next" value={next} />

            <div>
              <label
                htmlFor="password"
                className="text-xs font-extrabold uppercase tracking-[0.16em] text-felicio-ink/50"
              >
                Senha de acesso
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoFocus
                className="mt-2 w-full rounded-2xl border border-black/8 bg-white px-4 py-3.5 text-sm text-felicio-ink outline-none transition focus:border-felicio-pink/35"
              />
            </div>

            {hasError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">
                Senha incorreta. Tente novamente.
              </div>
            )}

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-felicio-pink to-felicio-lilac px-5 py-3.5 text-sm font-extrabold text-white shadow-soft transition hover:brightness-105"
            >
              Entrar no site
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
