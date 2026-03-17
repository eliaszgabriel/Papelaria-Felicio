import { sendEmail } from "@/lib/email";
import { paidTemplate } from "@/lib/emailTemplates";
import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";

type PaidOrderRow = {
  id: string;
  status: string;
  total: number;
  customerEmail: string | null;
  customerJson: string | null;
  paidNotifiedAt: number | null;
};

type CustomerPayload = {
  name?: string;
  email?: string;
};

function safeParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function sendPaidEmailIfNeeded(orderId: string) {
  let row: PaidOrderRow | undefined;

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const result = await pool.query<PaidOrderRow>(
      `
      SELECT
        id,
        status,
        total,
        customeremail AS "customerEmail",
        customerjson AS "customerJson",
        paidnotifiedat AS "paidNotifiedAt"
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
          customerJson,
          paidNotifiedAt
        FROM orders
        WHERE id = ?
        LIMIT 1
        `,
      )
      .get(orderId) as PaidOrderRow | undefined;
  }

  if (!row) return { ok: false as const, reason: "order_not_found" };
  if (row.paidNotifiedAt) return { ok: true as const, skipped: true as const };

  const email = String(row.customerEmail || "").trim();
  if (!email) return { ok: false as const, reason: "missing_customer_email" };

  const customer = safeParse<CustomerPayload>(row.customerJson);
  const tpl = paidTemplate({
    id: String(row.id),
    total: Number(row.total || 0),
    status: String(row.status || "pago"),
    customer: {
      email,
      name: customer?.name,
    },
  });

  await sendEmail({
    to: email,
    subject: tpl.subject,
    html: tpl.html,
  });

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    await pool.query(`UPDATE orders SET paidnotifiedat = $1 WHERE id = $2`, [
      Date.now(),
      String(row.id),
    ]);
  } else {
    const { db } = await import("@/lib/db");
    db.prepare(`UPDATE orders SET paidNotifiedAt = ? WHERE id = ?`).run(
      Date.now(),
      String(row.id),
    );
  }

  return { ok: true as const, skipped: false as const };
}
