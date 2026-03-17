import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/adminAuth";
import { validateCsrfRequest } from "@/lib/csrf";
import { fetchOlistProducts, isOlistConfigured } from "@/lib/olist";
import { importOlistProducts } from "@/lib/olistImport";

export const runtime = "nodejs";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  const csrfError = validateCsrfRequest(request);
  if (csrfError) {
    return csrfError;
  }

  if (!(await isAdminSession())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (!isOlistConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Complete a configuracao da integracao Olist/Tiny antes de sincronizar.",
      },
      { status: 400 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const page = Math.max(1, Number(body?.page || 1));
    const offset = Math.max(0, Number(body?.offset || 0));
    const batchSize = Math.min(20, Math.max(1, Number(body?.batchSize || 10)));
    const pagesPerRun = Math.min(5, Math.max(1, Number(body?.pagesPerRun || 1)));
    const pauseMs = Math.min(5000, Math.max(0, Number(body?.pauseMs || 1200)));
    const forceStockEndpoint = body?.forceStockEndpoint === true;

    let currentPage = page;
    let pagesProcessed = 0;
    let total = 0;
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let hasMore = false;
    let mode: "partners" | "tiny" = "tiny";
    let currentOffset = offset;

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
      pagesProcessed += 1;
      currentPage = result.nextPage;
      currentOffset = result.nextOffset;

      if (index < pagesPerRun - 1) {
        await sleep(pauseMs);
      }
    }

    return NextResponse.json({
      ok: true,
      total,
      created,
      updated,
      skipped,
      pageStart: page,
      offsetStart: offset,
      pageEnd: currentPage,
      offsetEnd: currentOffset,
      nextPage: currentPage,
      nextOffset: currentOffset,
      pagesProcessed,
      batchSize,
      pagesPerRun,
      hasMore,
      mode,
      forceStockEndpoint,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Falha ao sincronizar Olist.",
      },
      { status: 500 },
    );
  }
}
