import Image from "next/image";
import Link from "next/link";
import Container from "./Container";

export default function Footer() {
  return (
    <footer className="relative z-10 bg-transparent">
      <div className="absolute inset-0 -z-10 bg-white/15 backdrop-blur-sm" />
      <Container>
        <div className="grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-lg font-extrabold">Papelaria Felicio</div>
            <p className="mt-2 text-sm text-felicio-ink/75">
              Papelaria bonita, pratica e feita com carinho para deixar a rotina
              mais leve.
            </p>
          </div>

          <div className="text-sm">
            <div className="mb-2 font-extrabold">Ajuda</div>
            <ul className="space-y-2 text-felicio-ink/75">
              <li>
                <Link
                  href="/trocas-e-devolucoes"
                  className="transition hover:text-felicio-ink"
                >
                  Trocas e devolucoes
                </Link>
              </li>
              <li>
                <Link
                  href="/prazo-e-envio"
                  className="transition hover:text-felicio-ink"
                >
                  Prazo e envio
                </Link>
              </li>
              <li>
                <Link
                  href="/pagamento"
                  className="transition hover:text-felicio-ink"
                >
                  Pagamento
                </Link>
              </li>
            </ul>
          </div>

          <div className="text-sm">
            <div className="mb-2 font-extrabold">Institucional</div>
            <ul className="space-y-2 text-felicio-ink/75">
              <li>
                <Link
                  href="/sobre-nos"
                  className="transition hover:text-felicio-ink"
                >
                  Sobre nos
                </Link>
              </li>
              <li>
                <Link
                  href="/politica-de-privacidade"
                  className="transition hover:text-felicio-ink"
                >
                  Politica de privacidade
                </Link>
              </li>
              <li>
                <Link
                  href="/termos-de-uso"
                  className="transition hover:text-felicio-ink"
                >
                  Termos de uso
                </Link>
              </li>
            </ul>
          </div>

          <div className="text-sm">
            <div className="mb-2 font-extrabold">Contato</div>
            <div className="space-y-2 text-felicio-ink/75">
              <p>papelariafelicio@gmail.com</p>
              <p>(41) 98901-5752</p>
              <p>
                Avenida Betonex 1551, Loja 12
                <br />
                Curitiba - Pinhais
              </p>
            </div>

            <a
              href="https://www.instagram.com/papelariafelicio?igsh=d3FiMWtna3hpbmd2&utm_source=qr"
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-felicio-pink/20 bg-white/75 px-3 py-2 text-sm font-semibold text-felicio-ink/80 transition hover:bg-white"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
              </svg>
              Instagram
            </a>
          </div>
        </div>

        <div className="flex flex-col gap-3 pb-8 pt-1 text-xs text-felicio-ink/60 sm:flex-row sm:items-center sm:justify-between">
          <div>© {new Date().getFullYear()} Papelaria Felicio - feito com carinho.</div>

          <a
            href="https://eliasdev.site"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 self-start rounded-full border border-white/75 bg-white/72 px-3 py-1.5 text-[11px] font-semibold text-felicio-ink/80 shadow-soft transition hover:bg-white"
          >
            <span>Desenvolvido por Elias</span>
            <span className="inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-cyan-200/50 bg-[#071014] shadow-[0_0_18px_rgba(64,244,255,0.14)]">
              <Image
                src="/elias-mark.svg"
                alt="Marca Elias"
                width={28}
                height={28}
                className="h-5 w-5"
              />
            </span>
          </a>
        </div>
      </Container>
    </footer>
  );
}
