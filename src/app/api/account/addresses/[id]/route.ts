import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateCsrfRequest } from "@/lib/csrf";
import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";
import { verifySessionToken } from "@/lib/sessionToken";

export const runtime = "nodejs";

type AddressPatchBody = {
  setDefault?: boolean;
  label?: string | null;
  recipientName?: string | null;
  phone?: string | null;
  zip?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  uf?: string | null;
};

async function getUserIdFromSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("pf_session")?.value;
  const payload = verifySessionToken(token);
  return payload ? Number(payload.sub) : null;
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const csrfError = validateCsrfRequest(req);
  if (csrfError) {
    return csrfError;
  }

  const userId = await getUserIdFromSession();
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });

  const { id } = await ctx.params;
  const addressId = decodeURIComponent(id);
  const body = (await req.json().catch(() => null)) as AddressPatchBody | null;

  if (body?.setDefault === true) {
    const now = Date.now();
    if (hasPostgresConfig()) {
      const pool = getPostgresPool();
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `UPDATE customer_addresses SET "isDefault" = 0 WHERE user_id = $1`,
          [userId],
        );
        await client.query(
          `UPDATE customer_addresses
           SET "isDefault" = 1, "updatedAt" = $1
           WHERE id = $2 AND user_id = $3`,
          [now, addressId, userId],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } else {
      const { db } = await import("@/lib/db");
      const tx = db.transaction(() => {
        db.prepare(
          "UPDATE customer_addresses SET isDefault = 0 WHERE user_id = ?",
        ).run(userId);
        db.prepare(
          "UPDATE customer_addresses SET isDefault = 1, updatedAt = ? WHERE id = ? AND user_id = ?",
        ).run(now, addressId, userId);
      });
      tx();
    }
    return NextResponse.json({ ok: true });
  }

  const fields: string[] = [];
  const params: Array<string | number | null> = [];

  const fieldMap: Record<keyof Omit<AddressPatchBody, "setDefault">, string> = {
    label: "label",
    recipientName: "recipientName",
    phone: "phone",
    zip: "zip",
    street: "street",
    number: "number",
    complement: "complement",
    district: "district",
    city: "city",
    uf: "uf",
  };

  (Object.keys(fieldMap) as Array<keyof Omit<AddressPatchBody, "setDefault">>).forEach(
    (key) => {
      if (typeof body?.[key] !== "undefined") {
        fields.push(`${fieldMap[key]} = ?`);
        params.push(body[key] ?? null);
      }
    },
  );

  if (!fields.length) {
    return NextResponse.json(
      { ok: false, error: "bad_request" },
      { status: 400 },
    );
  }

  fields.push("updatedAt = ?");
  params.push(Date.now(), addressId, userId);

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const convertedFields = fields.map((field, index) => {
      const [name] = field.split(" = ");
      const safeName =
        name === "updatedAt" || name === "recipientName" || name === "isDefault"
          ? `"${name}"`
          : name;
      return `${safeName} = $${index + 1}`;
    });
    await pool.query(
      `UPDATE customer_addresses SET ${convertedFields.join(", ")} WHERE id = $${params.length - 1} AND user_id = $${params.length}`,
      params,
    );
  } else {
    const { db } = await import("@/lib/db");
    db.prepare(
      `UPDATE customer_addresses SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`,
    ).run(...params);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const csrfError = validateCsrfRequest(req);
  if (csrfError) {
    return csrfError;
  }

  const userId = await getUserIdFromSession();
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });

  const { id } = await ctx.params;
  const addressId = decodeURIComponent(id);

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    await pool.query(
      `DELETE FROM customer_addresses WHERE id = $1 AND user_id = $2`,
      [addressId, userId],
    );
  } else {
    const { db } = await import("@/lib/db");
    db.prepare("DELETE FROM customer_addresses WHERE id = ? AND user_id = ?").run(
      addressId,
      userId,
    );
  }

  return NextResponse.json({ ok: true });
}
