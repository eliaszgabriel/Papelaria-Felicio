import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { sendEmail } from "@/lib/email";
import { invoiceTemplate, paidTemplate, shippedTemplate } from "@/lib/emailTemplates";
import { isAdminSession } from "@/lib/adminAuth";
import { validateCsrfRequest } from "@/lib/csrf";
import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";

export const runtime = "nodejs";

type NotifyType = "paid" | "shipped" | "invoice";
type NotifyOrderRow = {
  id: string;
  status: string;
  total: number;
  paymentMethod: string | null;
  customerEmail: string | null;
  customerJson: string | null;
  addressJson: string | null;
  itemsJson: string | null;
  paymentJson: string | null;
  trackingCode: string | null;
  trackingCarrier: string | null;
  trackingUrl: string | null;
};

type StoredInvoice = {
  url: string;
  filename: string;
  uploadedAt?: number | null;
  sentAt?: number | null;
};

function safeParse<T>(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function getStoredInvoice(paymentJson: string | null) {
  const payment = safeParse<Record<string, unknown>>(paymentJson);
  if (!payment || typeof payment.invoice !== "object" || !payment.invoice) {
    return null;
  }

  const invoice = payment.invoice as Record<string, unknown>;
  if (!invoice.url) {
    return null;
  }

  return {
    url: String(invoice.url),
    filename: String(invoice.filename || "nota-fiscal.pdf"),
    uploadedAt: invoice.uploadedAt ? Number(invoice.uploadedAt) : null,
    sentAt: invoice.sentAt ? Number(invoice.sentAt) : null,
  } satisfies StoredInvoice;
}

function buildPublicFilePath(fileUrl: string) {
  const pathname = String(fileUrl || "").split("?")[0];
  const relativePath = pathname.replace(/^\/+/, "");
  return path.join(process.cwd(), "public", relativePath);
}

async function markInvoiceSent(orderId: string, paymentJson: string | null, sentAt: number) {
  const payment = safeParse<Record<string, unknown>>(paymentJson) ?? {};
  const currentInvoice =
    payment.invoice && typeof payment.invoice === "object"
      ? (payment.invoice as Record<string, unknown>)
      : {};

  payment.invoice = {
    ...currentInvoice,
    sentAt,
  };

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    await pool.query(`UPDATE orders SET paymentjson = $1 WHERE id = $2`, [
      JSON.stringify(payment),
      orderId,
    ]);
    return;
  }

  const { db } = await import("@/lib/db");
  db.prepare(`UPDATE orders SET paymentJson = ? WHERE id = ?`).run(
    JSON.stringify(payment),
    orderId,
  );
}

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
  if (type !== "paid" && type !== "shipped" && type !== "invoice") {
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
        paymentmethod AS "paymentMethod",
        customerjson AS "customerJson",
        addressjson AS "addressJson",
        itemsjson AS "itemsJson",
        paymentjson AS "paymentJson",
        customeremail AS "customerEmail",
        trackingcode AS "trackingCode",
        trackingcarrier AS "trackingCarrier",
        trackingurl AS "trackingUrl"
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
          paymentMethod,
          customerJson,
          addressJson,
          itemsJson,
          paymentJson,
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

    if (type === "invoice") {
      const invoice = getStoredInvoice(row.paymentJson);
      if (!invoice?.url) {
        return NextResponse.json(
          { ok: false, error: "missing_invoice_pdf" },
          { status: 409 },
        );
      }

      const buffer = await fs.readFile(buildPublicFilePath(invoice.url));
      const customer =
        safeParse<{ name?: string; email?: string }>(row.customerJson) ?? {};
      const address = safeParse<{
        street?: string;
        number?: string;
        complement?: string;
        district?: string;
        city?: string;
        uf?: string;
        cep?: string;
      }>(row.addressJson);
      const items = safeParse<
        Array<{ title?: string; qty?: number; unitPrice?: number; price?: number }>
      >(row.itemsJson);

      const tpl = invoiceTemplate({
        id: String(row.id),
        total: Number(row.total || 0),
        status: String(row.status || "pago"),
        paymentMethod: row.paymentMethod,
        customer: {
          email,
          name: customer?.name,
        },
        address,
        items: items ?? [],
        invoiceUrl: `${process.env.SITE_URL ?? ""}${invoice.url}`,
      });

      await sendEmail({
        to: email,
        subject: tpl.subject,
        html: tpl.html,
        attachments: [
          {
            filename: invoice.filename,
            content: buffer.toString("base64"),
            contentType: "application/pdf",
          },
        ],
      });

      await markInvoiceSent(orderId, row.paymentJson, Date.now());
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
