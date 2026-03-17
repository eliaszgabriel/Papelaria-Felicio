import Link from "next/link";
import Container from "@/components/layout/Container";
import ProductCard from "@/components/product/ProductCard";
import AnimatedProductRail from "@/components/home/AnimatedProductRail";
import HomeCategoryStrip from "@/components/home/HomeCategoryStrip";
import { getInternalJsonFetchOptions, getInternalSiteUrl } from "@/lib/siteUrl";

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

type HomeProductsResponse = {
  items: HomeProduct[];
};

async function getHomeProducts(query: string) {
  const base = getInternalSiteUrl();
  const res = await fetch(
    `${base}/api/products?${query}`,
    getInternalJsonFetchOptions(),
  );
  if (!res.ok) return { items: [] } satisfies HomeProductsResponse;
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return { items: [] } satisfies HomeProductsResponse;
  }
  return (await res.json()) as HomeProductsResponse;
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
      Number(p.isCollection ?? 0) === 1 ? "Colecao" : "",
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

      <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {items.map((p) => (
          <div key={p.id} className="w-full min-w-0 max-w-[300px] justify-self-stretch sm:justify-self-start">
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
