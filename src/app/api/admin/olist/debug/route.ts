import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/adminAuth";
import { validateCsrfRequest } from "@/lib/csrf";
import { fetchTinyDebug } from "@/lib/olist";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const csrfError = validateCsrfRequest(request);
  if (csrfError) {
    return csrfError;
  }

  if (!(await isAdminSession())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const query = String(body?.query || "").trim();

    if (!query) {
      return NextResponse.json(
        { ok: false, error: "Informe um SKU ou codigo para diagnosticar." },
        { status: 400 },
      );
    }

    const result = await fetchTinyDebug(query);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Falha ao diagnosticar item da Tiny.",
      },
      { status: 500 },
    );
  }
}
