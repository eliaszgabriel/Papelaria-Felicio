import crypto from "crypto";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateCsrfRequest } from "@/lib/csrf";
import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";
import { getJwtSecret } from "@/lib/runtimeSecrets";

export const runtime = "nodejs";

type SessionPayload = {
  sub: string | number;
};

type AddressRow = {
  id: string;
  user_id: number;
  label: string | null;
  recipientName: string | null;
  phone: string | null;
  zip: string;
  street: string;
  number: string;
  complement: string | null;
  district: string | null;
  city: string;
  uf: string;
  isDefault: 0 | 1;
  createdAt: number;
  updatedAt: number;
};

type AddressBody = {
  label?: string | null;
  recipientName?: string | null;
  phone?: string | null;
  zip?: string;
  street?: string;
  number?: string;
  complement?: string | null;
  district?: string | null;
  city?: string;
  uf?: string;
  isDefault?: boolean | number;
};

async function getUserIdFromSession() {
  const jwtSecret = getJwtSecret();
  const cookieStore = await cookies();
  const token = cookieStore.get("pf_session")?.value;
  if (!token || !jwtSecret) return null;

  try {
    const payload = jwt.verify(token, jwtSecret) as SessionPayload;
    return Number(payload.sub);
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const userId = await getUserIdFromSession();
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });

  const url = new URL(req.url);
  const onlyDefault = url.searchParams.get("default") === "1";

  const sql = onlyDefault
    ? "SELECT * FROM customer_addresses WHERE user_id = ? AND isDefault = 1 LIMIT 1"
    : "SELECT * FROM customer_addresses WHERE user_id = ? ORDER BY isDefault DESC, updatedAt DESC";

  let rows: AddressRow[] = [];

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const result = await pool.query<AddressRow>(
      onlyDefault
        ? `SELECT
             id, user_id, label, recipientname AS "recipientName", phone,
             zip, street, number, complement, district, city, uf,
             isdefault AS "isDefault", createdat AS "createdAt", updatedat AS "updatedAt"
           FROM customer_addresses
           WHERE user_id = $1 AND isdefault = 1
           LIMIT 1`
        : `SELECT
             id, user_id, label, recipientname AS "recipientName", phone,
             zip, street, number, complement, district, city, uf,
             isdefault AS "isDefault", createdat AS "createdAt", updatedat AS "updatedAt"
           FROM customer_addresses
           WHERE user_id = $1
           ORDER BY isdefault DESC, updatedat DESC`,
      [userId],
    );
    rows = result.rows;
  } else {
    const { db } = await import("@/lib/db");
    rows = onlyDefault
      ? ([db.prepare(sql).get(userId)] as Array<AddressRow | undefined>).filter(
          Boolean,
        ) as AddressRow[]
      : (db.prepare(sql).all(userId) as AddressRow[]);
  }

  return NextResponse.json({ ok: true, items: rows });
}

export async function POST(req: Request) {
  const csrfError = validateCsrfRequest(req);
  if (csrfError) {
    return csrfError;
  }

  const userId = await getUserIdFromSession();
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });

  const body = (await req.json().catch(() => null)) as AddressBody | null;

  const zip = String(body?.zip || "").trim();
  const street = String(body?.street || "").trim();
  const number = String(body?.number || "").trim();
  const city = String(body?.city || "").trim();
  const uf = String(body?.uf || "").trim();

  if (!zip || !street || !number || !city || !uf) {
    return NextResponse.json(
      { ok: false, error: "bad_request" },
      { status: 400 },
    );
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  const isDefault = Number(body?.isDefault ? 1 : 0);

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (isDefault === 1) {
        await client.query(
          `UPDATE customer_addresses SET isdefault = 0 WHERE user_id = $1`,
          [userId],
        );
      }

      await client.query(
        `INSERT INTO customer_addresses (
          id, user_id, label, recipientname, phone,
          zip, street, number, complement, district, city, uf,
          isdefault, createdat, updatedat
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          id,
          userId,
          body?.label ?? null,
          body?.recipientName ?? null,
          body?.phone ?? null,
          zip,
          street,
          number,
          body?.complement ?? null,
          body?.district ?? null,
          city,
          uf,
          isDefault,
          now,
          now,
        ],
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
      if (isDefault === 1) {
        db.prepare(
          "UPDATE customer_addresses SET isDefault = 0 WHERE user_id = ?",
        ).run(userId);
      }

      db.prepare(
        `INSERT INTO customer_addresses (
          id, user_id, label, recipientName, phone,
          zip, street, number, complement, district, city, uf,
          isDefault, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        userId,
        body?.label ?? null,
        body?.recipientName ?? null,
        body?.phone ?? null,
        zip,
        street,
        number,
        body?.complement ?? null,
        body?.district ?? null,
        city,
        uf,
        isDefault,
        now,
        now,
      );
    });

    tx();
  }

  return NextResponse.json({ ok: true, id });
}
