import { NextResponse } from "next/server";

function toOrigin(value: string | null | undefined) {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getForwardedOrigin(req: Request) {
  const proto = req.headers.get("x-forwarded-proto");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");

  if (!proto || !host) return null;

  return toOrigin(`${proto}://${host}`);
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

  const forwardedOrigin = getForwardedOrigin(req);
  if (forwardedOrigin) {
    allowedOrigins.add(forwardedOrigin);
  }

  const origin = toOrigin(req.headers.get("origin"));
  if (origin && allowedOrigins.has(origin)) {
    return null;
  }

  const referer = toOrigin(req.headers.get("referer"));
  if (!origin && referer && allowedOrigins.has(referer)) {
    return null;
  }

  return NextResponse.json(
    {
      ok: false,
      error: "csrf_blocked",
      reason: "Sessao expirada ou origem invalida. Recarregue a pagina e tente novamente.",
    },
    { status: 403 },
  );
}
