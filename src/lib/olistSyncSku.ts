import { fetchOlistProducts, isOlistConfigured } from "@/lib/olist";
import { importOlistProducts } from "@/lib/olistImport";

export function isOlistSyncAuthorized(request: Request) {
  const secret = process.env.OLIST_SYNC_SECRET || "";
  if (!secret) return false;

  const headerSecret = request.headers.get("x-olist-sync-secret") || "";
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret") || "";

  return headerSecret === secret || querySecret === secret;
}

export async function syncOlistSku(sku: string) {
  if (!isOlistConfigured()) {
    throw new Error("olist_not_configured");
  }

  const normalizedSku = String(sku || "").trim();
  if (!normalizedSku) {
    throw new Error("sku_required");
  }

  const result = await fetchOlistProducts({
    page: 1,
    offset: 0,
    batchSize: 1,
    query: normalizedSku,
    forceStockEndpoint: true,
  });

  if (!result.items.length) {
    throw new Error("sku_not_found");
  }

  const imported = await importOlistProducts(result.items, {
    ignoreBlocked: true,
  });

  return {
    sku: normalizedSku,
    total: imported.total,
    created: imported.created,
    updated: imported.updated,
    skipped: imported.skipped,
    mode: result.mode,
  };
}
