import Link from "next/link";
import ProductCard from "@/components/product/ProductCard";

type RailProduct = {
  id: string;
  slug: string;
  title: string;
  price: number;
  oldPrice?: number;
  image?: string;
  stock?: number;
};

export default function AnimatedProductRail({
  items,
}: {
  items: RailProduct[];
}) {
  if (!items.length) return null;

  const duplicated = [...items, ...items];
  const mobileShortcuts = [
    {
      href: "/produtos?sort=new&deal=1&page=1",
      eyebrow: "Ofertas",
      title: "Achadinhos da semana",
      description: "Filtre o que esta com preco especial.",
    },
    {
      href: "/produtos?sort=new&page=1",
      eyebrow: "Novidades",
      title: "Chegou agora",
      description: "Veja o que entrou por ultimo na vitrine.",
    },
    {
      href: "/meus-pedidos",
      eyebrow: "Pedidos",
      title: "Acompanhe por aqui",
      description: "Consulte pagamento, entrega e historico.",
    },
  ];

  return (
    <section className="py-6">
      <div className="hidden items-end justify-between gap-4 md:flex">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/75 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-felicio-ink/65 sm:text-[11px] sm:tracking-[0.22em]">
            Vitrine em movimento
          </div>
          <h2 className="mt-4 max-w-[16rem] text-[2.15rem] font-extrabold tracking-tight text-felicio-ink/85 sm:max-w-none sm:text-3xl">
            Produtos passeando pela papelaria
          </h2>
          <p className="mt-2 max-w-[21rem] text-sm text-felicio-ink/65 sm:max-w-2xl sm:text-base">
            Uma seleção leve de produtos para inspirar a compra e destacar o
            que está mais bonito na vitrine.
          </p>
        </div>
      </div>

      <div className="md:hidden">
        <div className="rounded-[2rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(255,247,250,0.8))] p-4 shadow-soft">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/75 bg-white/80 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-felicio-ink/65">
            Comece por aqui
          </div>
          <h2 className="mt-4 text-[2.05rem] font-extrabold tracking-tight text-felicio-ink/85">
            Atalhos para comprar sem enrolacao
          </h2>
          <p className="mt-2 max-w-[20rem] text-sm leading-relaxed text-felicio-ink/63">
            No celular, fica mais gostoso ir direto para oferta, novidade ou acompanhar o pedido.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-3">
            {mobileShortcuts.map((shortcut) => (
              <Link
                key={shortcut.href}
                href={shortcut.href}
                className="rounded-[1.6rem] border border-white/75 bg-white/88 px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.06)] transition hover:-translate-y-0.5 hover:bg-white"
              >
                <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-felicio-pink">
                  {shortcut.eyebrow}
                </div>
                <div className="mt-2 text-base font-extrabold text-felicio-ink">
                  {shortcut.title}
                </div>
                <div className="mt-1 text-sm leading-relaxed text-felicio-ink/62">
                  {shortcut.description}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="product-rail-mask mt-6 hidden md:block">
        <div className="product-rail-track">
          {duplicated.map((product, index) => (
            <div
              key={`${product.id}-${index}`}
              className="product-rail-card"
              style={{ animationDelay: `${(index % items.length) * 0.45}s` }}
            >
              <ProductCard product={product} compact />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
