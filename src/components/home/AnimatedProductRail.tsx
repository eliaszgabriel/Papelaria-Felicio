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

  return (
    <section className="py-6">
      <div className="flex items-end justify-between gap-4">
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

      <div className="mt-6 flex gap-3 overflow-x-auto pb-2 pr-1 snap-x snap-mandatory md:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((product) => (
          <div key={product.id} className="w-[17.5rem] min-w-[17.5rem] snap-start">
            <ProductCard product={product} compact />
          </div>
        ))}
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
