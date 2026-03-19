import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { validateCsrfRequest } from "@/lib/csrf";
import { getExpiredCookieOptions } from "@/lib/secureCookies";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const csrfError = validateCsrfRequest(req);
  if (csrfError) {
    return csrfError;
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, "", {
    ...getExpiredCookieOptions("strict"),
  });
  return res;
}
