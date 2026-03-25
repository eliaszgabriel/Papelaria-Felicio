import Link from "next/link";
import Image from "next/image";
import { getCategoryShowcaseImage } from "@/lib/categoryShowcase";
import {
  getStorefrontCategories,
  type StorefrontCategory,
} from "@/lib/storefront";

const FEATURED_CATEGORY_IDS = [
  "mochilas",
  "cadernos",
  "fofuras",
  "desenhos",
  "escritorio",
] as const;

export default async function HomeCategoryStrip() {
  const allCategories = await getStorefrontCategories();
  const categories = FEATURED_CATEGORY_IDS.map((categoryId) =>
    allCategories.find((category) => String(category.id) === categoryId),
  ).filter((category): category is StorefrontCategory => Boolean(category));

  if (!categories.length) return null;

  const categoriesWithImage = await Promise.all(
    categories.map(async (category) => ({
      ...category,
      image: getCategoryShowcaseImage(category.id) || null,
    })),
  );

  return (
    <section className="py-8">
      <div className="rounded-[2rem] border border-white/70 bg-white/55 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.05)] backdrop-blur-lg">
        <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:items-center">
          <div>
            <div className="text-sm font-extrabold uppercase tracking-[0.18em] text-felicio-ink/45">
              Curadoria
            </div>
            <h2 className="mt-3 text-2xl font-extrabold leading-tight text-felicio-ink/85">
              Compre por categoria
            </h2>
            <p className="mt-3 text-sm leading-6 text-felicio-ink/65">
              Um atalho rápido para quem já sabe o estilo de produto que quer
              explorar.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
            {categoriesWithImage.map((category) => (
              <Link
                key={category.id}
                href={`/produtos?category=${encodeURIComponent(String(category.id))}`}
                className="group text-center"
              >
                <div className="relative mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(255,245,248,0.82))] shadow-[0_14px_30px_rgba(0,0,0,0.06)] transition duration-300 group-hover:-translate-y-1 group-hover:scale-[1.02] group-hover:shadow-[0_18px_38px_rgba(0,0,0,0.1)]">
                  <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-white/0 transition duration-300 group-hover:ring-white/60" />
                  {category.image ? (
                    <Image
                      src={category.image}
                      alt={category.name}
                      width={160}
                      height={160}
                      className="h-full w-full bg-white/45 object-contain p-3 transition duration-300 group-hover:scale-[1.03]"
                      unoptimized
                    />
                  ) : (
                    <div className="h-full w-full bg-[radial-gradient(circle_at_top,rgba(244,150,180,0.18),transparent_45%),linear-gradient(135deg,rgba(255,255,255,0.85),rgba(247,236,240,0.85))]" />
                  )}
                </div>

                <div className="mt-3 text-sm font-extrabold leading-5 text-felicio-ink/82">
                  {category.name}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
