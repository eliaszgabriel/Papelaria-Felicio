import { NextResponse } from "next/server";
import { fetchOlistProducts, isOlistConfigured } from "@/lib/olist";
import { importOlistProducts } from "@/lib/olistImport";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const secret = process.env.OLIST_SYNC_SECRET || "";
  if (!secret) return false;

  const headerSecret = request.headers.get("x-olist-sync-secret") || "";
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret") || "";

  return headerSecret === secret || querySecret === secret;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!isOlistConfigured()) {
    return NextResponse.json(
      { ok: false, error: "olist_not_configured" },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { sku?: string; externalSku?: string }
    | null;

  const sku = String(body?.sku || body?.externalSku || "").trim();
  if (!sku) {
    return NextResponse.json(
      { ok: false, error: "sku_required" },
      { status: 400 },
    );
  }

  try {
    const result = await fetchOlistProducts({
      page: 1,
      offset: 0,
      batchSize: 1,
      query: sku,
      forceStockEndpoint: true,
    });

    if (!result.items.length) {
      return NextResponse.json(
        { ok: false, error: "sku_not_found", sku },
        { status: 404 },
      );
    }

    const imported = await importOlistProducts(result.items, {
      ignoreBlocked: true,
    });

    return NextResponse.json({
      ok: true,
      sku,
      total: imported.total,
      created: imported.created,
      updated: imported.updated,
      skipped: imported.skipped,
      mode: result.mode,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "olist_sync_sku_failed",
      },
      { status: 500 },
    );
  }
}
