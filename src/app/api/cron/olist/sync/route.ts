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

function isOlistRateLimitError(error: unknown) {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return (
    message.includes("excedido o numero de acessos") ||
    message.includes("api bloqueada") ||
    message.includes("too many requests")
  );
}

function isOlistPageOverflowError(error: unknown) {
  if (!(error instanceof Error)) return false;

  const match = error.message.match(/pagina\s+(\d+)\s+de\s+(\d+)/i);
  if (!match) return false;

  const requestedPage = Number(match[1]);
  const totalPages = Number(match[2]);
  return Number.isFinite(requestedPage) && Number.isFinite(totalPages) && requestedPage > totalPages;
}

async function runSyncBatch(
  startPage: number,
  startOffset: number,
  batchSize: number,
  pagesPerRun: number,
  pauseMs: number,
  forceStockEndpoint: boolean,
) {
  let currentPage = startPage;
  let currentOffset = startOffset;
  let total = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let hasMore = false;
  let mode: "partners" | "tiny" = "tiny";

  for (let index = 0; index < pagesPerRun; index += 1) {
    const result = await fetchOlistProducts({
      page: currentPage,
      offset: currentOffset,
      batchSize,
      forceStockEndpoint,
    });
    const imported = await importOlistProducts(result.items);

    total += imported.total;
    created += imported.created;
    updated += imported.updated;
    skipped += imported.skipped;
    hasMore = result.hasMore;
    mode = result.mode;
    currentPage = result.nextPage;
    currentOffset = result.nextOffset;

    if (index < pagesPerRun - 1) {
      await sleep(pauseMs);
    }
  }

  return {
    total,
    created,
    updated,
    skipped,
    hasMore,
    mode,
    currentPage,
    currentOffset,
  };
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
    Math.max(1, Number(process.env.OLIST_SYNC_BATCH_SIZE || 1)),
  );
  const pagesPerRun = Math.min(
    5,
    Math.max(1, Number(process.env.OLIST_SYNC_PAGES_PER_RUN || 1)),
  );
  const pauseMs = Math.min(
    5000,
    Math.max(0, Number(process.env.OLIST_SYNC_PAUSE_MS || 1200)),
  );
  const retryDelayMs = Math.min(
    15000,
    Math.max(1000, Number(process.env.OLIST_SYNC_RETRY_DELAY_MS || 5000)),
  );
  const forceStockEndpoint =
    String(process.env.OLIST_SYNC_FORCE_STOCK_ENDPOINT || "1").trim() !== "0";

  try {
    const result = await runSyncBatch(
      cursor.page,
      cursor.offset,
      batchSize,
      pagesPerRun,
      pauseMs,
      forceStockEndpoint,
    );

    await saveOlistSyncCursor(result.currentPage, result.currentOffset);

    return NextResponse.json({
      ok: true,
      total: result.total,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      pageStart: cursor.page,
      offsetStart: cursor.offset,
      nextPage: result.currentPage,
      nextOffset: result.currentOffset,
      hasMore: result.hasMore,
      mode: result.mode,
      batchSize,
      pagesPerRun,
      forceStockEndpoint,
    });
  } catch (error) {
    if (isOlistRateLimitError(error)) {
      return NextResponse.json(
        {
          ok: false,
          error: error instanceof Error ? error.message : "olist_sync_rate_limited",
          rateLimited: true,
          retryAfterMs: retryDelayMs,
        },
        { status: 429 },
      );
    }

    if (isOlistPageOverflowError(error)) {
      await saveOlistSyncCursor(1, 0);

      try {
        const restarted = await runSyncBatch(
          1,
          0,
          batchSize,
          pagesPerRun,
          pauseMs,
          forceStockEndpoint,
        );
        await saveOlistSyncCursor(restarted.currentPage, restarted.currentOffset);

        return NextResponse.json({
          ok: true,
          total: restarted.total,
          created: restarted.created,
          updated: restarted.updated,
          skipped: restarted.skipped,
          pageStart: 1,
          offsetStart: 0,
          nextPage: restarted.currentPage,
          nextOffset: restarted.currentOffset,
          hasMore: restarted.hasMore,
          mode: restarted.mode,
          batchSize,
          pagesPerRun,
          forceStockEndpoint,
          restartedFromBeginning: true,
        });
      } catch (restartError) {
        if (isOlistRateLimitError(restartError)) {
          return NextResponse.json(
            {
              ok: false,
              error:
                restartError instanceof Error
                  ? restartError.message
                  : "olist_sync_rate_limited",
              rateLimited: true,
              retryAfterMs: retryDelayMs,
            },
            { status: 429 },
          );
        }

        return NextResponse.json(
          {
            ok: false,
            error:
              restartError instanceof Error
                ? restartError.message
                : "olist_sync_restart_failed",
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "olist_sync_failed",
      },
      { status: 500 },
    );
  }
}
