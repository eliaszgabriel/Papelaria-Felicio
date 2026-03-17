import type { ProductFull } from "./ProductPage";

export default function ProductDetails({ product }: { product: ProductFull }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-[2.5rem] border border-white/60 bg-white/50 p-6 shadow-soft backdrop-blur">
        <h2 className="text-xl font-extrabold">Descricao</h2>
        <p className="mt-3 leading-relaxed text-felicio-ink/75">
          {product.description}
        </p>
      </div>

      <div className="rounded-[2.5rem] border border-white/60 bg-white/50 p-6 shadow-soft backdrop-blur">
        <h2 className="text-xl font-extrabold">O que vem no produto</h2>
        <ul className="mt-3 space-y-2 text-felicio-ink/75">
          {product.details.map((detail) => (
            <li key={detail} className="flex items-start gap-2">
              <span className="mt-2 h-2 w-2 rounded-full bg-felicio-pink" />
              <span>{detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
