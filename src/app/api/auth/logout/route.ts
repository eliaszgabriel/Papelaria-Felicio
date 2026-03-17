import { NextResponse } from "next/server";
import { validateCsrfRequest } from "@/lib/csrf";

export async function POST(req: Request) {
  const csrfError = validateCsrfRequest(req);
  if (csrfError) {
    return csrfError;
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("pf_session", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
