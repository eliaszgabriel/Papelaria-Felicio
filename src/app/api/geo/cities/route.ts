import { NextResponse } from "next/server";

export const runtime = "nodejs";

const UF_TO_ID: Record<string, number> = {
  AC: 12,
  AL: 27,
  AP: 16,
  AM: 13,
  BA: 29,
  CE: 23,
  DF: 53,
  ES: 32,
  GO: 52,
  MA: 21,
  MT: 51,
  MS: 50,
  MG: 31,
  PA: 15,
  PB: 25,
  PR: 41,
  PE: 26,
  PI: 22,
  RJ: 33,
  RN: 24,
  RS: 43,
  RO: 11,
  RR: 14,
  SC: 42,
  SP: 35,
  SE: 28,
  TO: 17,
};

type IbgeCity = {
  nome?: string;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const uf = String(searchParams.get("uf") || "")
    .trim()
    .toUpperCase();

  const id = UF_TO_ID[uf];
  if (!id) {
    return NextResponse.json(
      { ok: false, reason: "uf_invalid" },
      { status: 400 },
    );
  }

  const url = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${id}/municipios`;
  const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, reason: "ibge_failed" },
      { status: 502 },
    );
  }

  const data = (await res.json().catch(() => [])) as IbgeCity[];
  const cities = Array.isArray(data)
    ? data.map((city) => String(city?.nome || "")).filter(Boolean)
    : [];

  return NextResponse.json({ ok: true, cities });
}
