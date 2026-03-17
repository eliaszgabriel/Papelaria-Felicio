import { NextResponse } from "next/server";
import {
  createSiteLockToken,
  getSiteLockCookieName,
  getSiteLockPassword,
  isSiteLockEnabled,
} from "@/lib/siteLock";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isSiteLockEnabled()) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const form = await req.formData().catch(() => null);
  const password = String(form?.get("password") || "");
  const nextPath = String(form?.get("next") || "/");

  if (!password || password !== getSiteLockPassword()) {
    return NextResponse.redirect(
      new URL(`/site-lock?error=1&next=${encodeURIComponent(nextPath)}`, req.url),
    );
  }

  const response = NextResponse.redirect(new URL(nextPath || "/", req.url));
  response.cookies.set(getSiteLockCookieName(), await createSiteLockToken(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
