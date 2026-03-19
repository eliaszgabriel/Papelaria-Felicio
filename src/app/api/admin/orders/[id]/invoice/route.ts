import { NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { isAdminSession } from "@/lib/adminAuth";
import { validateCsrfRequest } from "@/lib/csrf";
import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";

export const runtime = "nodejs";

const MAX_PDF_BYTES = 10 * 1024 * 1024;

function isPdf(buffer: Buffer) {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

function sanitizeFilename(filename: string) {
  const cleaned = String(filename || "")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned || "nota-fiscal"}.pdf`;
}

function safeParse<T>(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
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
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const orderId = decodeURIComponent(id);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "Arquivo da nota ausente." },
      { status: 400 },
    );
  }

  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json(
      { ok: false, error: "PDF muito grande. Maximo de 10MB." },
      { status: 400 },
    );
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  if (!isPdf(buffer)) {
    return NextResponse.json(
      { ok: false, error: "Arquivo invalido. Envie um PDF real." },
      { status: 400 },
    );
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "invoices");
  await fs.mkdir(uploadDir, { recursive: true });

  const storedFilename = `${orderId}-${crypto.randomUUID()}.pdf`;
  const publicUrl = `/uploads/invoices/${storedFilename}`;
  await fs.writeFile(path.join(uploadDir, storedFilename), buffer);

  const originalFilename = sanitizeFilename(file.name);
  const uploadedAt = Date.now();

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const current = await pool.query<{ paymentJson: string | null }>(
      `SELECT paymentjson AS "paymentJson" FROM orders WHERE id = $1 LIMIT 1`,
      [orderId],
    );
    const row = current.rows[0];

    if (!row) {
      return NextResponse.json({ ok: false, error: "order_not_found" }, { status: 404 });
    }

    const payment = safeParse<Record<string, unknown>>(row.paymentJson) ?? {};
    const previousInvoice =
      payment.invoice && typeof payment.invoice === "object"
        ? (payment.invoice as Record<string, unknown>)
        : {};

    payment.invoice = {
      ...previousInvoice,
      url: publicUrl,
      filename: originalFilename,
      uploadedAt,
    };

    await pool.query(`UPDATE orders SET paymentjson = $1 WHERE id = $2`, [
      JSON.stringify(payment),
      orderId,
    ]);
  } else {
    const { db } = await import("@/lib/db");
    const row = db
      .prepare(`SELECT paymentJson FROM orders WHERE id = ? LIMIT 1`)
      .get(orderId) as { paymentJson: string | null } | undefined;

    if (!row) {
      return NextResponse.json({ ok: false, error: "order_not_found" }, { status: 404 });
    }

    const payment = safeParse<Record<string, unknown>>(row.paymentJson) ?? {};
    const previousInvoice =
      payment.invoice && typeof payment.invoice === "object"
        ? (payment.invoice as Record<string, unknown>)
        : {};

    payment.invoice = {
      ...previousInvoice,
      url: publicUrl,
      filename: originalFilename,
      uploadedAt,
    };

    db.prepare(`UPDATE orders SET paymentJson = ? WHERE id = ?`).run(
      JSON.stringify(payment),
      orderId,
    );
  }

  return NextResponse.json({
    ok: true,
    invoice: {
      url: publicUrl,
      filename: originalFilename,
      uploadedAt,
    },
  });
}
