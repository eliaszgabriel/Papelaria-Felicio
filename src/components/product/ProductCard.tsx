import Link from "next/link";
import Image from "next/image";
import Button from "@/components/ui/Button";

type Product = {
  id: string;
  slug: string;
  title: string;
  price: number;
  oldPrice?: number;
  tag?: "novo" | "promo" | "volta-as-aulas";
  image?: string;
  stock?: number;
  badges?: string[];
};

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const tagStyle: Record<NonNullable<Product["tag"]>, string> = {
  novo: "bg-felicio-mint/35 text-felicio-ink border-white/50",
  promo: "bg-felicio-pink/35 text-felicio-ink border-white/50",
  "volta-as-aulas": "bg-felicio-sun/35 text-felicio-ink border-white/50",
};

const tagLabel: Record<NonNullable<Product["tag"]>, string> = {
  novo: "Novo",
  promo: "Promo",
  "volta-as-aulas": "Volta às aulas",
};

export default function ProductCard({
  product,
  compact = false,
}: {
  product: Product;
  compact?: boolean;
}) {
  const hasPromo =
    typeof product.oldPrice === "number" && product.oldPrice > product.price;

  const outOfStock = Number(product.stock ?? 0) <= 0;
  const href = `/produtos/${encodeURIComponent(product.slug)}`;
  const stockCount = Number(product.stock ?? 0);
  const stockLabel = outOfStock
    ? compact
      ? "Sem estoque"
      : "Sem estoque no momento"
    : stockCount <= 5
      ? `Últimas ${stockCount} unidades`
      : `Em estoque: ${stockCount}`;
  const badges = Array.isArray(product.badges)
    ? product.badges.filter(Boolean).slice(0, 2)
    : [];
  const titleClampStyle = compact
    ? {
        display: "-webkit-box",
        WebkitLineClamp: 3,
        WebkitBoxOrient: "vertical" as const,
        overflow: "hidden",
      }
    : undefined;

  return (
    <article
      className="
        group relative flex h-full flex-col overflow-hidden
        rounded-[2rem] border border-white/70
        bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,0.72))]
        backdrop-blur-xl
        shadow-[0_18px_50px_rgba(0,0,0,0.08)]
        transition duration-300
        hover:-translate-y-2 hover:shadow-[0_28px_65px_rgba(0,0,0,0.14)]
      "
    >
      <div className="pointer-events-none absolute inset-x-6 top-0 h-20 rounded-b-[2rem] bg-gradient-to-b from-white/60 to-transparent" />
      <div className="pointer-events-none absolute -right-12 top-10 h-28 w-28 rounded-full bg-felicio-lilac/18 blur-2xl transition duration-500 group-hover:scale-125 group-hover:opacity-90" />
      <div className="pointer-events-none absolute -left-10 bottom-12 h-24 w-24 rounded-full bg-felicio-mint/18 blur-2xl transition duration-500 group-hover:scale-125 group-hover:opacity-90" />
      <div className="pointer-events-none absolute inset-0 rounded-[2rem] ring-1 ring-white/0 transition duration-300 group-hover:ring-white/50" />

      <Link
        href={href}
        className="absolute inset-0 z-10 cursor-pointer"
        aria-label={`Abrir ${product.title}`}
      />

      <div className={compact ? "relative p-2.5 sm:p-3.5" : "relative p-4"}>
        <div className="relative overflow-hidden rounded-[1.6rem] border border-white/70 bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
          {product.image ? (
            <Image
              src={product.image}
              alt={product.title}
              width={640}
              height={640}
              className={[
                "w-full bg-white/65 object-contain transition duration-300",
                compact ? "p-2.5 sm:p-3" : "p-4",
                "group-hover:scale-[1.01]",
                compact ? "h-[126px] sm:h-[158px]" : "h-[220px]",
              ].join(" ")}
              loading="lazy"
              unoptimized
            />
          ) : (
            <div
              className={[
                "w-full bg-gradient-to-br from-felicio-lilac/15 via-felicio-pink/10 to-felicio-mint/15",
                compact ? "h-[126px] sm:h-[158px]" : "h-[220px]",
              ].join(" ")}
            />
          )}

          <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div className="absolute -top-10 -left-10 h-40 w-40 rounded-full bg-white/35 blur-2xl" />
            <div className="absolute inset-y-0 -left-1/3 w-1/3 rotate-[12deg] bg-white/25 blur-xl transition duration-700 group-hover:left-[115%]" />
          </div>

          <div className="pointer-events-none absolute inset-x-4 bottom-4 translate-y-2 rounded-full bg-white/88 px-3 py-2 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-felicio-ink/55 opacity-0 shadow-soft transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            Toque para ver detalhes
          </div>
        </div>

        {product.tag && (
          <span
            className={[
              "absolute left-6 top-6 inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold",
              tagStyle[product.tag],
            ].join(" ")}
          >
            {tagLabel[product.tag]}
          </span>
        )}

        {outOfStock && (
          <span className="absolute right-6 top-6 inline-flex items-center rounded-full border border-white/60 bg-white/75 px-3 py-1 text-xs font-extrabold text-felicio-ink/70">
            Esgotado
          </span>
        )}
      </div>

      <div
        className={
          compact
            ? "flex flex-1 flex-col px-2.5 pb-3.5 sm:px-[18px] sm:pb-[18px]"
            : "flex flex-1 flex-col px-6 pb-6"
        }
      >
        <div
          className={[
            "flex flex-wrap items-center gap-1 text-[9px] font-extrabold uppercase tracking-[0.14em] text-felicio-ink/45 sm:gap-2 sm:text-[11px] sm:tracking-[0.18em]",
            compact ? "mb-1.5 min-h-[1.65rem] sm:mb-3 sm:min-h-[2rem]" : "mb-3 min-h-[2rem]",
          ].join(" ")}
        >
          {badges.length > 0 &&
            badges.map((badge) => (
              <span key={badge} className="rounded-full bg-white/85 px-2 py-1">
                {badge}
              </span>
            ))}
        </div>

        <h3
          className={
            compact
              ? "min-h-[4.65rem] text-[11px] font-extrabold leading-snug text-felicio-ink sm:min-h-[5rem] sm:text-[15px]"
              : "text-base font-extrabold leading-snug text-felicio-ink"
          }
          style={titleClampStyle}
        >
          {product.title}
        </h3>

        <div className="mt-auto flex items-end justify-between gap-2 pt-2 sm:gap-3 sm:pt-3">
          <div className="min-w-0 flex-1">
            <div
              className={
                compact
                  ? "text-[0.82rem] font-extrabold sm:text-[1.05rem]"
                  : "text-lg font-extrabold"
              }
            >
              {formatBRL(Number(product.price || 0))}
            </div>

            {hasPromo && (
              <div className="text-[9px] text-felicio-ink/55 line-through sm:text-sm">
                {formatBRL(Number(product.oldPrice || 0))}
              </div>
            )}

            <div className="mt-1 inline-flex max-w-full rounded-full border border-black/5 bg-white/75 px-2 py-1 text-[8px] font-semibold leading-tight text-felicio-ink/60 sm:mt-2 sm:px-3 sm:text-[11px]">
              {stockLabel}
            </div>
          </div>

          <div className="relative z-20 shrink-0">
            <Link href={href}>
              <Button
                className={[
                  "shadow-[0_12px_30px_rgba(244,150,180,0.25)] transition duration-300 group-hover:shadow-[0_16px_34px_rgba(244,150,180,0.34)]",
                  compact
                    ? "min-w-[6.4rem] px-2.5 py-1.5 text-[10px] leading-none sm:min-w-[unset] sm:px-3 sm:py-2 sm:text-xs"
                    : "px-4 py-2 text-sm",
                ].join(" ")}
                disabled={outOfStock}
              >
                {outOfStock ? "Esgotado" : "Ver produto"}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
