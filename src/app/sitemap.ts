import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/siteUrl";
import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";

type ProductSitemapRow = {
  slug: string;
  updatedAt: number;
  active: number;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/produtos`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/carrinho`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/checkout`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${siteUrl}/conta`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/meus-pedidos`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.4,
    },
  ];

  let products: ProductSitemapRow[] = [];

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const result = await pool.query<ProductSitemapRow>(
      `SELECT slug, updatedat AS "updatedAt", active FROM products WHERE active = 1 ORDER BY updatedat DESC`,
    );
    products = result.rows;
  } else {
    const { db } = await import("@/lib/db");
    products = db
      .prepare(
        "SELECT slug, updatedAt, active FROM products WHERE active = 1 ORDER BY updatedAt DESC",
      )
      .all() as ProductSitemapRow[];
  }

  const productRoutes = products.map((product) => ({
    url: `${siteUrl}/produtos/${encodeURIComponent(product.slug)}`,
    lastModified: new Date(
      Number.isFinite(Number(product.updatedAt))
        ? Number(product.updatedAt)
        : Date.now(),
    ),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticRoutes, ...productRoutes];
}
