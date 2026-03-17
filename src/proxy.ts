import { NextRequest, NextResponse } from "next/server";

import { ADMIN_COOKIE_NAME } from "@/lib/adminAuth";

const ADMIN_LOGIN_PATH = "/admin/login";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
  matcher: ["/admin/:path*"],
};
