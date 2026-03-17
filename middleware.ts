import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  getSiteLockBypassHeaderName,
  getSiteLockBypassHeaderValue,
  getSiteLockCookieName,
  isSiteLockEnabled,
  verifySiteLockToken,
} from "@/lib/siteLock";

function isPublicPath(pathname: string) {
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/site-lock") ||
    pathname.startsWith("/api/site-lock") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/api/cron/") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/manifest.webmanifest"
  ) {
    return true;
  }

  return /\.[a-zA-Z0-9]+$/.test(pathname);
}

export async function middleware(req: NextRequest) {
  if (!isSiteLockEnabled()) {
    return NextResponse.next();
  }

  const { pathname, search } = req.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const bypassHeader = req.headers.get(getSiteLockBypassHeaderName());
  if (bypassHeader && bypassHeader === getSiteLockBypassHeaderValue()) {
    return NextResponse.next();
  }

  const token = req.cookies.get(getSiteLockCookieName())?.value;
  const unlocked = await verifySiteLockToken(token);

  if (unlocked) {
    const response = NextResponse.next();
    response.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
    return response;
  }

  const redirectUrl = req.nextUrl.clone();
  redirectUrl.pathname = "/site-lock";
  redirectUrl.search = `?next=${encodeURIComponent(`${pathname}${search}`)}`;
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: "/:path*",
};
