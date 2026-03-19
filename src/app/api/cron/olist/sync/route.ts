import { NextResponse } from "next/server";
import { fetchOlistProducts, isOlistConfigured } from "@/lib/olist";
import { importOlistProducts } from "@/lib/olistImport";
import { getOlistSyncCursor, saveOlistSyncCursor } from "@/lib/olistSyncState";
import { secureCompareText } from "@/lib/secureCompare";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const secret = process.env.OLIST_SYNC_SECRET || "";
  if (!secret) return false;

  const headerSecret = request.headers.get("x-olist-sync-secret") || "";
  return secureCompareText(headerSecret, secret);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  const cursor = await getOlistSyncCursor();
  const batchSize = Math.min(
    20,
    Math.max(1, Number(process.env.OLIST_SYNC_BATCH_SIZE || 10)),
  );
  const pagesPerRun = Math.min(
    5,
    Math.max(1, Number(process.env.OLIST_SYNC_PAGES_PER_RUN || 1)),
  );
  const pauseMs = Math.min(
    5000,
    Math.max(0, Number(process.env.OLIST_SYNC_PAUSE_MS || 1200)),
  );

  let currentPage = cursor.page;
  let currentOffset = cursor.offset;
  let total = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;

  try {
    for (let index = 0; index < pagesPerRun; index += 1) {
      const result = await fetchOlistProducts({
        page: currentPage,
        offset: currentOffset,
        batchSize,
      });
      const imported = await importOlistProducts(result.items);

      total += imported.total;
      created += imported.created;
      updated += imported.updated;
      skipped += imported.skipped;
      currentPage = result.nextPage;
      currentOffset = result.nextOffset;

      if (index < pagesPerRun - 1) {
        await sleep(pauseMs);
      }
    }

    await saveOlistSyncCursor(currentPage, currentOffset);

    return NextResponse.json({
      ok: true,
      total,
      created,
      updated,
      skipped,
      pageStart: cursor.page,
      offsetStart: cursor.offset,
      nextPage: currentPage,
      nextOffset: currentOffset,
      batchSize,
      pagesPerRun,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "olist_sync_failed",
      },
      { status: 500 },
    );
  }
}
