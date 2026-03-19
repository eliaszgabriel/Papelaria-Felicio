import { NextRequest, NextResponse } from "next/server";

import { ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import {
  getSiteLockBypassHeaderName,
  getSiteLockBypassHeaderValue,
  getSiteLockCookieName,
  isSiteLockEnabled,
  verifySiteLockToken,
} from "@/lib/siteLock";

const ADMIN_LOGIN_PATH = "/admin/login";

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

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isSiteLockEnabled() && !isPublicPath(pathname)) {
    const bypassHeader = request.headers.get(getSiteLockBypassHeaderName());
    if (
      !bypassHeader ||
      bypassHeader !== getSiteLockBypassHeaderValue()
    ) {
      const token = request.cookies.get(getSiteLockCookieName())?.value;
      const unlocked = await verifySiteLockToken(token);

      if (!unlocked) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/site-lock";
        redirectUrl.search = `?next=${encodeURIComponent(`${pathname}${search}`)}`;
        return NextResponse.redirect(redirectUrl);
      }

      const response = NextResponse.next();
      response.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
      return response;
    }
  }

  if (!pathname.startsWith("/admin") || pathname === ADMIN_LOGIN_PATH) {
    return NextResponse.next();
  }

  const adminCookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (adminCookie) {
    return NextResponse.next();
  }

  const loginUrl = new URL(ADMIN_LOGIN_PATH, request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/:path*"],
};
