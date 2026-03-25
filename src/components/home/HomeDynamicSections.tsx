import Link from "next/link";
import Container from "@/components/layout/Container";
import ProductCard from "@/components/product/ProductCard";
import AnimatedProductRail from "@/components/home/AnimatedProductRail";
import HomeCategoryStrip from "@/components/home/HomeCategoryStrip";
import {
  getStorefrontProducts,
  parseStorefrontProductQuery,
} from "@/lib/storefront";

export const dynamic = "force-dynamic";

type HomeProduct = {
  id: string | number;
  slug: string;
  name?: string;
  title?: string;
  price?: number;
  compareAtPrice?: number | null;
  coverImage?: string | null;
  images?: Array<{ url?: string | null }> | null;
  stock?: number | null;
  inMovingShowcase?: number | null;
  isCollection?: number | null;
  isWeeklyFavorite?: number | null;
};

async function getHomeProducts(query: string) {
  return getStorefrontProducts(parseStorefrontProductQuery(query));
}

function mapToCard(p: HomeProduct) {
  return {
    id: String(p.id),
    slug: String(p.slug),
    title: String(p.name ?? p.title ?? ""),
    price: Number(p.price || 0),
    oldPrice: p.compareAtPrice ? Number(p.compareAtPrice) : undefined,
    image:
      p.coverImage || (Array.isArray(p.images) ? p.images[0]?.url : "") || "",
    stock: Number(p.stock ?? 0),
    badges: [
      Number(p.isCollection ?? 0) === 1 ? "Coleção" : "",
      Number(p.isWeeklyFavorite ?? 0) === 1 ? "Favoritos da semana" : "",
    ].filter(Boolean),
  };
}

function Section({
  title,
  href,
  items,
  accent = "pink",
}: {
  title: string;
  href: string;
  items: HomeProduct[];
  accent?: "pink" | "sun";
}) {
  const accentBar =
    accent === "sun" ? "bg-felicio-sun/70" : "bg-felicio-pink/60";

  return (
    <section className="py-4 sm:py-5">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end sm:gap-4">
        <div>
          <h2 className="text-[1.45rem] font-extrabold tracking-tight text-felicio-ink/85 sm:text-3xl">
            {title}
          </h2>
          <div className={`mt-2 h-[3px] w-12 rounded-full ${accentBar}`} />
        </div>

        <Link
          href={href}
          className="text-sm font-extrabold text-felicio-ink/60 transition hover:text-felicio-ink/90"
        >
          Ver todos →
        </Link>
      </div>

      <div className="mt-4 flex gap-3 overflow-x-auto pb-2 pr-1 snap-x snap-mandatory sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:pb-0 xl:grid-cols-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((p) => (
          <div
            key={p.id}
            className="w-[10.7rem] min-w-[10.7rem] max-w-[10.7rem] snap-start sm:w-full sm:min-w-0 sm:max-w-[300px] sm:justify-self-start"
          >
            <ProductCard product={mapToCard(p)} compact />
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function HomeDynamicSections() {
  const [featured, deals, news, movingShowcase] = await Promise.all([
    getHomeProducts("featured=1&limit=8&sort=new"),
    getHomeProducts("deal=1&limit=8&sort=new"),
    getHomeProducts("sort=new&limit=8"),
    getHomeProducts("movingShowcase=1&limit=8&sort=new"),
  ]);

  const featuredItems = Array.isArray(featured?.items) ? featured.items : [];
  const dealItems = Array.isArray(deals?.items) ? deals.items : [];
  const newItems = Array.isArray(news?.items) ? news.items : [];
  const movingItems = Array.isArray(movingShowcase?.items)
    ? movingShowcase.items
    : [];
  const showcaseItems = movingItems.slice(0, 8).map(mapToCard);

  if (!featuredItems.length && !dealItems.length && !newItems.length) {
    return null;
  }

  return (
    <div className="mt-4">
      <Container>
        <HomeCategoryStrip />

        {showcaseItems.length > 0 && (
          <AnimatedProductRail items={showcaseItems} />
        )}

        {featuredItems.length > 0 && (
          <Section
            title="Destaques"
            href="/produtos?featured=1"
            items={featuredItems}
            accent="pink"
          />
        )}

        {dealItems.length > 0 && (
          <Section
            title="Ofertas"
            href="/produtos?deal=1"
            items={dealItems}
            accent="sun"
          />
        )}

        {newItems.length > 0 && (
          <Section title="Novidades" href="/produtos?sort=new" items={newItems} />
        )}
      </Container>
    </div>
  );
}
