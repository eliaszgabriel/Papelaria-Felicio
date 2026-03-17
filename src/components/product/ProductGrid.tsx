import Link from "next/link";
import Container from "@/components/layout/Container";
import ProductCard from "./ProductCard";
import { getSiteUrl } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";

type Props = {
  title: React.ReactNode;
  subtitle?: string;
  query?: string;
  limit?: number;
  showCta?: boolean;
};

type ProductGridImage = {
  url?: string;
};

type ProductGridItem = {
  id: string | number;
  slug: string;
  name: string;
  price: number;
  compareAtPrice?: number | null;
  coverImage?: string | null;
  images?: ProductGridImage[];
  stock?: number | null;
  isCollection?: number | null;
  isWeeklyFavorite?: number | null;
};

type ProductGridResponse = {
  items: ProductGridItem[];
};

async function getProducts(query?: string): Promise<ProductGridResponse> {
  const base = getSiteUrl();
  const qs = query ? `?${query}` : "";
  const res = await fetch(`${base}/api/products${qs}`, { cache: "no-store" });

  if (!res.ok) {
    return { items: [] };
  }

  return (await res.json()) as ProductGridResponse;
}

export default async function ProductGrid({
  title,
  subtitle,
  query,
  limit = 8,
  showCta = false,
}: Props) {
  const data = await getProducts(query);
  const items = Array.isArray(data?.items) ? data.items : [];

  return (
    <section className="mt-12">
      <Container>
        <div className="text-center">
          <h2 className="text-3xl font-extrabold sm:text-4xl">{title}</h2>
          {subtitle && <p className="mt-2 text-felicio-ink/70">{subtitle}</p>}
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.slice(0, limit).map((product) => (
            <ProductCard
              key={product.id}
              product={{
                id: String(product.id),
                slug: String(product.slug),
                title: String(product.name),
                price: Number(product.price || 0),
                oldPrice: product.compareAtPrice
                  ? Number(product.compareAtPrice)
                  : undefined,
                image:
                  product.coverImage ||
                  (Array.isArray(product.images)
                    ? product.images[0]?.url || ""
                    : "") ||
                  "",
                stock: Number(product.stock ?? 0),
                badges: [
                  Number(product.isCollection ?? 0) === 1 ? "Coleção" : "",
                  Number(product.isWeeklyFavorite ?? 0) === 1
                    ? "Favoritos da semana"
                    : "",
                ].filter(Boolean),
              }}
            />
          ))}
        </div>

        {showCta && (
          <div className="mt-8 flex justify-center">
            <Link
              href="/produtos"
              className="rounded-full border border-white/70 bg-white/70 px-6 py-3 text-sm font-extrabold shadow-soft transition hover:bg-white/90"
            >
              Ver todos os produtos
            </Link>
          </div>
        )}
      </Container>
    </section>
  );
}
