import { NextResponse } from "next/server";
import {
  cleanupExpiredPendingOrders,
  getOrderCleanupConfig,
} from "@/lib/orderCleanup";
import { secureCompareText } from "@/lib/secureCompare";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const { secret } = getOrderCleanupConfig();
  if (!secret) return false;

  const headerSecret = request.headers.get("x-order-cleanup-secret") || "";
  return secureCompareText(headerSecret, secret);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await cleanupExpiredPendingOrders();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "order_cleanup_failed",
      },
      { status: 500 },
    );
  }
}
