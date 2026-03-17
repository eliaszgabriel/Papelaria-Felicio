import { NextResponse } from "next/server";

function toOrigin(value: string | null | undefined) {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function validateCsrfRequest(req: Request) {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null;
  }

  const allowedOrigins = new Set<string>();
  allowedOrigins.add(new URL(req.url).origin);

  const siteUrlOrigin = toOrigin(process.env.SITE_URL || "");
  if (siteUrlOrigin) {
    allowedOrigins.add(siteUrlOrigin);
  }

  const origin = toOrigin(req.headers.get("origin"));
  if (origin && allowedOrigins.has(origin)) {
    return null;
  }

  const referer = toOrigin(req.headers.get("referer"));
  if (referer && allowedOrigins.has(referer)) {
    return null;
  }

  return NextResponse.json(
    { ok: false, error: "csrf_blocked" },
    { status: 403 },
  );
}
