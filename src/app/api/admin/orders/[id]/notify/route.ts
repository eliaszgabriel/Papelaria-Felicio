import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { paidTemplate, shippedTemplate } from "@/lib/emailTemplates";
import { isAdminSession } from "@/lib/adminAuth";
import { validateCsrfRequest } from "@/lib/csrf";
import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";

export const runtime = "nodejs";

type NotifyType = "paid" | "shipped";
type NotifyOrderRow = {
  id: string;
  status: string;
  total: number;
  customerEmail: string | null;
  trackingCode: string | null;
  trackingCarrier: string | null;
  trackingUrl: string | null;
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const csrfError = validateCsrfRequest(req);
  if (csrfError) {
    return csrfError;
  }

  if (!(await isAdminSession())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { id } = await ctx.params;
  const orderId = decodeURIComponent(id);

  const body = (await req.json().catch(() => null)) as {
    type?: NotifyType;
  } | null;

  const type = body?.type;
  if (type !== "paid" && type !== "shipped") {
    return NextResponse.json(
      { ok: false, error: "bad_request" },
      { status: 400 },
    );
  }

  let row: NotifyOrderRow | undefined;

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const result = await pool.query<NotifyOrderRow>(
      `
      SELECT
        id,
        status,
        total,
        "customerEmail",
        "trackingCode",
        "trackingCarrier",
        "trackingUrl"
      FROM orders
      WHERE id = $1
      LIMIT 1
      `,
      [orderId],
    );
    row = result.rows[0];
  } else {
    const { db } = await import("@/lib/db");
    row = db
      .prepare(
        `
        SELECT
          id,
          status,
          total,
          customerEmail,
          trackingCode,
          trackingCarrier,
          trackingUrl
        FROM orders
        WHERE id = ?
        LIMIT 1
        `,
      )
      .get(orderId) as NotifyOrderRow | undefined;
  }

  if (!row) {
    return NextResponse.json(
      { ok: false, error: "order_not_found" },
      { status: 404 },
    );
  }

  const email = String(row.customerEmail || "").trim();
  if (!email) {
    return NextResponse.json(
      { ok: false, error: "missing_customer_email" },
      { status: 409 },
    );
  }

  try {
    if (type === "paid") {
      const tpl = paidTemplate({
        id: String(row.id),
        total: Number(row.total || 0),
        status: "pago",
        customer: { email },
      });

      await sendEmail({ to: email, subject: tpl.subject, html: tpl.html });
    }

    if (type === "shipped") {
      const tpl = shippedTemplate({
        id: String(row.id),
        total: Number(row.total || 0),
        status: "enviado",
        customer: { email },
        trackingCode: row.trackingCode ?? null,
        trackingCarrier: row.trackingCarrier ?? null,
        trackingUrl: row.trackingUrl ?? null,
      });

      await sendEmail({ to: email, subject: tpl.subject, html: tpl.html });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin:notify] error", error);
    return NextResponse.json(
      { ok: false, error: "email_failed" },
      { status: 502 },
    );
  }
}
