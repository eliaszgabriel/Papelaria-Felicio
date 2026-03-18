import { NextResponse } from "next/server";
import { isOlistConfigured } from "@/lib/olist";
import { isOlistSyncAuthorized, syncOlistSku } from "@/lib/olistSyncSku";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isOlistSyncAuthorized(request)) {
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
    const imported = await syncOlistSku(sku);

    return NextResponse.json({
      ok: true,
      ...imported,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "olist_sync_sku_failed";
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
