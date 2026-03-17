import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { orderId, status, customerWhats, total } = await req.json();

    if (!orderId || !status || !customerWhats) {
      return NextResponse.json(
        { ok: false, error: "Dados inválidos" },
        { status: 400 }
      );
    }

    const message =
      `✨ *Papelaria Felicio* ✨\n\n` +
      `Seu pedido *${orderId}* teve atualização:\n\n` +
      `📦 *Status:* ${String(status).toUpperCase()}\n` +
      `💰 *Total:* R$ ${Number(total || 0).toFixed(2)}\n\n` +
      `Obrigada por comprar com carinho 💗`;

    const whats = String(customerWhats).replace(/\D/g, "");
    const link = `https://wa.me/55${whats}?text=${encodeURIComponent(message)}`;

    return NextResponse.json({ ok: true, whatsappLink: link });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Erro interno" },
      { status: 500 }
    );
  }
}
