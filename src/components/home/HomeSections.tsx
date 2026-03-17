import ProductGrid from "@/components/product/ProductGrid";

export const dynamic = "force-dynamic";

export default function HomeSections() {
  return (
    <>
      <ProductGrid
        title={
          <>
            Destaques da <span className="text-felicio-pink">semana</span>
          </>
        }
        subtitle="Os queridinhos que valem a pena ver primeiro."
        query="featured=1&sort=new"
        limit={8}
      />

      <ProductGrid
        title={
          <>
            Ofertas <span className="text-felicio-pink">fofas</span>
          </>
        }
        subtitle="Promoções e achadinhos com preço especial."
        query="deal=1&sort=new"
        limit={8}
      />

      <ProductGrid
        title={
          <>
            Novidades <span className="text-felicio-pink">recentes</span>
          </>
        }
        subtitle="Chegou agora na vitrine."
        query="sort=new"
        limit={8}
        showCta
      />
    </>
  );
}
