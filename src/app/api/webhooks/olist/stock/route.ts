import { NextResponse } from "next/server";
import { isOlistConfigured } from "@/lib/olist";
import { syncOlistSku } from "@/lib/olistSyncSku";

export const runtime = "nodejs";

type OlistWebhookPayload = {
  dados?: {
    sku?: string;
    skuMapeamento?: string;
    saldo?: number | string;
    idProduto?: string | number;
  };
  sku?: string;
  skuMapeamento?: string;
  saldo?: number | string;
};

function isAuthorized(request: Request) {
  const secret = process.env.OLIST_STOCK_WEBHOOK_SECRET || process.env.OLIST_SYNC_SECRET || "";
  if (!secret) return false;

  const headerSecret =
    request.headers.get("x-olist-stock-secret") ||
    request.headers.get("x-olist-sync-secret") ||
    "";
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret") || url.searchParams.get("token") || "";

  return headerSecret === secret || querySecret === secret;
}

function extractSku(payload: OlistWebhookPayload | null) {
  return String(
    payload?.dados?.sku ||
      payload?.dados?.skuMapeamento ||
      payload?.sku ||
      payload?.skuMapeamento ||
      "",
  ).trim();
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

  const payload = (await request.json().catch(() => null)) as OlistWebhookPayload | null;
  const sku = extractSku(payload);

  if (!sku) {
    return NextResponse.json(
      { ok: false, error: "sku_required" },
      { status: 400 },
    );
  }

  try {
    const synced = await syncOlistSku(sku);

    return NextResponse.json({
      ok: true,
      source: "olist_stock_webhook",
      saldo: payload?.dados?.saldo ?? payload?.saldo ?? null,
      ...synced,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "olist_stock_webhook_failed";
    const status =
      message === "sku_not_found" ? 404 : message === "sku_required" ? 400 : 500;

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status },
    );
  }
}
