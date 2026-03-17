import { NextResponse } from "next/server";
import { calculateMockShipping } from "@/lib/shipping";

export const runtime = "nodejs";

type RequestBody = {
  cep: string;
  subtotal: number;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;

    if (!body.cep || body.subtotal === undefined) {
      return NextResponse.json(
        {
          ok: false,
          error: "CEP e subtotal sao obrigatorios",
        },
        { status: 400 },
      );
    }

    const subtotal = Number(body.subtotal);
    if (Number.isNaN(subtotal) || subtotal < 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Subtotal invalido",
        },
        { status: 400 },
      );
    }

    const result = calculateMockShipping(subtotal, body.cep);

    if (result.error) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      price: result.price,
      deadline: result.deadline,
    });
  } catch (error) {
    console.error("Erro ao calcular frete:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Erro ao calcular frete",
      },
      { status: 500 },
    );
  }
}
