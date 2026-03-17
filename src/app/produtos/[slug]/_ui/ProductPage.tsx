import ProductBreadcrumb from "./ProductBreadcrumb";
import ProductGallery from "./ProductGallery";
import ProductInfo from "./ProductInfo";
import ProductDetails from "./ProductDetails";

type ProductTag = "novo" | "promo" | "volta-as-aulas";

export type ProductFull = {
  id: string;
  slug: string;
  title: string;
  price: number;
  oldPrice?: number;
  tag?: ProductTag;
  images: string[];
  short: string;
  description: string;
  details: string[];
  stock: number;
};

export default function ProductPage({ product }: { product: ProductFull }) {
  return (
    <div className="space-y-6">
      <ProductBreadcrumb
        items={[
          { label: "Inicio", href: "/" },
          { label: "Produtos", href: "/produtos" },
          { label: product.title, href: `/produtos/${product.slug}` },
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <ProductGallery images={product.images} title={product.title} />
        <ProductInfo product={product} />
      </div>

      <ProductDetails product={product} />
    </div>
  );
}
