import type { Metadata } from "next";
import Link from "next/link";
import ProductGallery from "./_ui/ProductGallery";
import ProductInfo from "./_ui/ProductInfo";
import { getSiteUrl } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";

type ProductImage = {
  url: string;
  sortOrder?: number | null;
};

type ProductResponse = {
  product?: {
    id: string | number;
    slug: string;
    name: string;
    price: number;
    compareAtPrice?: number | null;
    description?: string | null;
    coverImage?: string | null;
    stock?: number | null;
    images?: ProductImage[];
    isCollection?: number | null;
    isWeeklyFavorite?: number | null;
  };
};

async function getProduct(slug: string): Promise<ProductResponse | null> {
  const base = getSiteUrl();
  const res = await fetch(`${base}/api/products/${encodeURIComponent(slug)}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return null;
  }

  return (await res.json()) as ProductResponse;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getProduct(slug);
  const product = data?.product;

  if (!product) {
    return {
      title: "Produto nao encontrado | Papelaria Felicio",
    };
  }

  const siteUrl = getSiteUrl();
  const title = `${product.name} | Papelaria Felicio`;
  const description =
    (product.description || "").trim() ||
    "Produto da Papelaria Felicio com compra online, Pix automatico e envio para todo o Brasil.";
  const images = (product.images ?? []).map((image) => image.url).filter(Boolean);
  const ogImage = images[0] || product.coverImage || `${siteUrl}/logo.svg`;
  const canonical = `${siteUrl}/produtos/${encodeURIComponent(product.slug)}`;

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      images: [
        {
          url: ogImage,
          alt: product.name,
        },
      ],
    },
  };
}

export default async function ProdutoSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getProduct(slug);
  const product = data?.product;

  if (!product) {
    return (
      <section className="py-10 sm:py-12">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          Produto nao encontrado.
        </div>
      </section>
    );
  }

  const images = (product.images ?? [])
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((image) => image.url)
    .filter(Boolean);

  const mainImage = images[0] || product.coverImage || "";
  const description = (product.description || "").trim();

  const productForInfo = {
    id: String(product.id),
    slug: String(product.slug),
    title: String(product.name),
    price: Number(product.price || 0),
    oldPrice: product.compareAtPrice ? Number(product.compareAtPrice) : undefined,
    short:
      description ||
      "Um produto especial da Papelaria Felicio para deixar sua rotina mais leve e bonita.",
    image: mainImage || undefined,
    stock: Number(product.stock ?? 0),
    badges: [
      Number(product.isCollection ?? 0) === 1 ? "Colecao" : "",
      Number(product.isWeeklyFavorite ?? 0) === 1
        ? "Favoritos da semana"
        : "",
    ].filter(Boolean),
  };

  return (
    <section className="py-10 sm:py-12">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <nav className="text-sm text-felicio-ink/60">
          <Link href="/" className="transition hover:text-felicio-ink/80">
            Inicio
          </Link>
          <span className="mx-2">/</span>
          <Link href="/produtos" className="transition hover:text-felicio-ink/80">
            Produtos
          </Link>
          <span className="mx-2">/</span>
          <span className="font-semibold text-felicio-ink/80">{product.name}</span>
        </nav>

        <div className="mt-5 grid gap-6 lg:grid-cols-12 lg:gap-7">
          <div className="lg:col-span-7">
            <ProductGallery images={images} title={product.name} />
          </div>

          <div className="lg:col-span-5">
            <ProductInfo product={productForInfo} />
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div className="rounded-[2rem] border border-white/60 bg-white/70 p-5 shadow-soft backdrop-blur sm:p-6">
              <div className="flex items-center gap-3 text-xs font-extrabold uppercase tracking-[0.18em] text-felicio-ink/45">
                <span>Descricao</span>
                <span className="h-px w-8 bg-felicio-ink/12" />
                <span className="normal-case tracking-normal text-sm font-semibold text-felicio-ink/52">
                  Informacoes principais do produto.
                </span>
              </div>

              <div className="mt-4 whitespace-pre-wrap text-sm leading-6 text-felicio-ink/72">
                {description || "Sem descricao cadastrada no momento."}
              </div>
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="rounded-[2rem] border border-white/60 bg-white/60 p-5 shadow-soft backdrop-blur sm:p-6">
              <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-felicio-ink/45">
                Compra segura
              </div>
              <h3 className="mt-2 text-lg font-extrabold text-felicio-ink/90">
                Resumo rapido
              </h3>

              <div className="mt-4 space-y-3.5 text-sm text-felicio-ink/72">
                <div className="flex items-center justify-between">
                  <span>Estoque</span>
                  <span className="font-bold">{Number(product.stock ?? 0)}</span>
                </div>

                <div className="h-px bg-black/5" />

                <div className="space-y-2 text-sm">
                  <div className="rounded-2xl bg-white/78 px-4 py-2.5">
                    Pix automatico e confirmacao rapida
                  </div>
                  <div className="rounded-2xl bg-white/78 px-4 py-2.5">
                    Cartao disponivel no checkout
                  </div>
                  <div className="rounded-2xl bg-white/78 px-4 py-2.5">
                    Suporte e acompanhamento do pedido
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
