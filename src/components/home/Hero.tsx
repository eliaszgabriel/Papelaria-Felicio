import Image from "next/image";
import Link from "next/link";
import Container from "../layout/Container";
import Button from "../ui/Button";

export default function Hero() {
  const spotlightCards = [
    {
      label: "Canetas",
      href: "/produtos?category=canetas",
      image: "/canetas.png",
    },
    {
      label: "Cadernos",
      href: "/produtos?category=cadernos",
      image: "/c.png",
    },
    {
      label: "Presentes",
      href: "/produtos?category=presentes",
      image: "/e.png",
    },
  ];

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(circle_at_top_left,rgba(244,150,180,0.10),transparent_34%),radial-gradient(circle_at_top_right,rgba(191,168,255,0.09),transparent_34%),radial-gradient(circle_at_50%_24%,rgba(255,215,138,0.08),transparent_26%)]" />

      <Container>
        <div className="grid items-center gap-10 py-10 lg:grid-cols-2 lg:py-14">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/75 px-3.5 py-2 text-[11px] font-semibold shadow-[0_10px_30px_rgba(0,0,0,0.05)] sm:px-4 sm:text-xs">
              <span className="h-2 w-2 rounded-full bg-felicio-pink" />
              Curadoria delicada para presentear e organizar com carinho
            </div>

            <h1 className="mt-5 text-4xl font-extrabold leading-[0.95] tracking-tight sm:text-5xl lg:text-6xl">
              Papelaria que parece
              <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-felicio-pink via-felicio-lilac to-felicio-sun bg-clip-text text-transparent">
                presente aberto.
              </span>
            </h1>

            <p className="mt-4 max-w-xl text-base text-felicio-ink/80 sm:text-lg">
              Produtos fofos, presentes delicados e uma navegação mais gostosa
              para transformar compra rápida em experiência especial.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/produtos?featured=1">
                <Button className="shadow-[0_14px_36px_rgba(244,150,180,0.32)]">
                  Ver destaques
                </Button>
              </Link>
              <Link href="/produtos?deal=1">
                <Button variant="soft" className="border border-white/70">
                  Ver ofertas
                </Button>
              </Link>
            </div>

            <div className="mt-8 grid max-w-xl grid-cols-3 gap-2 sm:gap-3">
              {[
                ["Pix", "Confirmação automática"],
                ["Estoque", "Atualizado no pedido"],
                ["Curadoria", "Mais leve e premium"],
              ].map(([title, text]) => (
                <div
                  key={title}
                  className="rounded-[1.35rem] border border-white/65 bg-white/70 px-3 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.05)] backdrop-blur sm:rounded-[1.5rem] sm:px-4 sm:py-4"
                >
                  <div className="text-[13px] font-extrabold text-felicio-ink/85 sm:text-sm">
                    {title}
                  </div>
                  <div className="mt-1 text-[11px] leading-snug text-felicio-ink/60 sm:text-xs">
                    {text}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-10 rounded-[2.5rem] bg-white/22 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2.15rem] border border-white/65 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,255,255,0.54))] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.08)] backdrop-blur-xl sm:rounded-[2.5rem] sm:p-6">
              <div className="absolute -right-8 top-6 h-32 w-32 rounded-full bg-felicio-lilac/10 blur-3xl" />
              <div className="absolute -left-8 bottom-4 h-28 w-28 rounded-full bg-felicio-mint/10 blur-3xl" />

              <div className="relative overflow-hidden rounded-[1.9rem] bg-gradient-to-br from-felicio-sun/22 via-felicio-pink/24 to-felicio-lilac/22 p-4 sm:rounded-3xl sm:p-6">
                <div className="pointer-events-none absolute inset-0">
                  <Image
                    src="/vitrine-semana.png"
                    alt=""
                    fill
                    className="object-cover object-center opacity-[0.16] mix-blend-multiply"
                    sizes="(max-width: 1024px) 100vw, 520px"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,251,248,0.74),rgba(255,255,255,0.28))]" />
                </div>

                <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-felicio-ink/65 sm:text-sm">
                      Vitrine da semana
                    </div>
                    <div className="mt-2 text-[2rem] font-extrabold leading-[1.02] text-felicio-ink/92 sm:text-3xl">
                      Escolha o clima
                      <br />
                      da sua compra.
                    </div>
                    <div className="mt-2 max-w-md text-sm text-felicio-ink/75">
                      Tudo o que aparece aqui leva para uma seleção real da loja.
                    </div>
                  </div>

                  <Link
                    href="/produtos?featured=1"
                    className="rounded-full border border-felicio-pink/20 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(252,232,239,0.82))] px-4 py-2 text-xs font-extrabold uppercase tracking-[0.16em] text-felicio-ink/72 shadow-[0_10px_24px_rgba(244,150,180,0.12)] transition hover:-translate-y-0.5 hover:bg-white"
                  >
                    Ver vitrine
                  </Link>
                </div>

                <div className="relative mt-6 grid grid-cols-3 gap-2 sm:gap-3">
                  {spotlightCards.map((item, index) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={[
                        "group relative overflow-hidden rounded-[1.1rem] border border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(252,241,244,0.88))] p-2 text-center text-xs font-semibold text-felicio-ink/78 shadow-[0_14px_35px_rgba(255,255,255,0.20)] transition hover:-translate-y-1 hover:bg-white sm:rounded-2xl sm:p-3 sm:text-sm",
                        index === 1 ? "translate-y-2 sm:translate-y-4" : "",
                      ].join(" ")}
                    >
                      <div className="relative overflow-hidden rounded-[1rem]">
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.45))]" />
                        <Image
                          src={item.image}
                          alt={item.label}
                          width={220}
                          height={160}
                          className="h-16 w-full object-cover transition duration-500 group-hover:scale-105 sm:h-20"
                          unoptimized
                        />
                      </div>
                      <div className="mt-2 sm:mt-3">{item.label}</div>
                    </Link>
                  ))}
                </div>

                <div className="relative mt-6 rounded-[1.35rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,244,247,0.9),rgba(255,255,255,0.68))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] sm:rounded-[1.6rem] sm:p-4">
                  <div className="flex items-center justify-between gap-3 text-sm font-semibold text-felicio-ink/85">
                    <span>Seleção da semana</span>
                    <span className="rounded-full border border-felicio-pink/20 bg-[linear-gradient(135deg,rgba(244,150,180,0.24),rgba(255,215,138,0.24))] px-3 py-1 text-xs font-extrabold uppercase tracking-[0.16em] text-felicio-ink/70">
                      Em alta
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
                    {[
                      ["Destaques da loja", "/produtos?featured=1"],
                      ["Ofertas do momento", "/produtos?deal=1"],
                      ["Cadernos delicados", "/produtos?category=cadernos"],
                      ["Presentes delicados", "/produtos?category=presentes"],
                    ].map(([label, href]) => (
                      <Link
                        key={label}
                        href={href}
                        className="rounded-[1rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,248,251,0.98),rgba(252,226,236,0.92)_44%,rgba(255,236,198,0.88))] px-3 py-2.5 text-xs font-semibold leading-snug text-felicio-ink/80 shadow-[0_10px_24px_rgba(244,150,180,0.12)] transition hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(244,150,180,0.18)] sm:rounded-2xl sm:py-3 sm:text-sm"
                      >
                        {label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
