import { NextResponse } from "next/server";
import {
  createSiteLockToken,
  getSiteLockCookieName,
  getSiteLockPassword,
  isSiteLockEnabled,
} from "@/lib/siteLock";
import { consumeRateLimit, getRequestIp } from "@/lib/rateLimit";
import { getSiteLockCookieOptions } from "@/lib/secureCookies";
import { getSiteUrl } from "@/lib/siteUrl";

export const runtime = "nodejs";

function getPublicBaseUrl(req: Request) {
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host");

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`.replace(/\/+$/, "");
  }

  return getSiteUrl();
}

export async function POST(req: Request) {
  const baseUrl = getPublicBaseUrl(req);

  if (!isSiteLockEnabled()) {
    return NextResponse.redirect(new URL("/", baseUrl));
  }

  const form = await req.formData().catch(() => null);
  const password = String(form?.get("password") || "");
  const nextPath = String(form?.get("next") || "/");

  const rateLimit = await consumeRateLimit({
    scope: "site-lock",
    key: getRequestIp(req),
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.ok) {
    return NextResponse.redirect(
      new URL(`/site-lock?error=1&next=${encodeURIComponent(nextPath)}`, baseUrl),
    );
  }

  if (!password || password !== getSiteLockPassword()) {
    return NextResponse.redirect(
      new URL(`/site-lock?error=1&next=${encodeURIComponent(nextPath)}`, baseUrl),
    );
  }

  const response = NextResponse.redirect(new URL(nextPath || "/", baseUrl));
  response.cookies.set(getSiteLockCookieName(), await createSiteLockToken(password), {
    ...getSiteLockCookieOptions(),
  });
  return response;
}
