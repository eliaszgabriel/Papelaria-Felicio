import { NextResponse } from "next/server";
import { validateCsrfRequest } from "@/lib/csrf";
import { getExpiredCookieOptions } from "@/lib/secureCookies";

export async function POST(req: Request) {
  const csrfError = validateCsrfRequest(req);
  if (csrfError) {
    return csrfError;
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("pf_session", "", {
    ...getExpiredCookieOptions("lax"),
  });
  return res;
}
