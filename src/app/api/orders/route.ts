import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { pushinpayCreatePixCashIn } from "@/lib/pushinpay";
import { calculateMockShipping } from "@/lib/shipping";
import {
  createMercadoPagoPreference,
} from "@/lib/mercadoPago";
import { getStripeClient } from "@/lib/stripe";
import { isValidCPF, onlyDigits } from "@/lib/validators";
import {
  createOrderLookupToken,
  verifyOrderLookupToken,
} from "@/lib/orderAccess";
import { getStripeStatus } from "@/lib/stripeConfig";
import { getMercadoPagoStatus } from "@/lib/mercadoPagoConfig";
import { sendNewOrderAdminEmail } from "@/lib/adminOrderNotifications";
import { validateCsrfRequest } from "@/lib/csrf";
import { consumeRateLimit, getRequestIp } from "@/lib/rateLimit";
import { sendEmail } from "@/lib/email";
import { createEmailVerificationToken } from "@/lib/emailVerification";
import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";
import { getSiteUrl } from "@/lib/siteUrl";
import { escapeHtml, sanitizeEmailUrl } from "@/lib/htmlEscape";
import {
  requireConfiguredSecret,
  requireJwtSecret,
} from "@/lib/runtimeSecrets";

export const runtime = "nodejs";

function ensureJwtSecret() {
  requireJwtSecret();
}

function createServerOrderId() {
  return `FEL-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function normEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function safeParse<T = unknown>(value: unknown): T | null {
  if (!value) return null;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return null;
  }
}

function getPublicBaseUrl(req: Request) {
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost =
    req.headers.get("x-forwarded-host") || req.headers.get("host");

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`.replace(/\/+$/, "");
  }

  const siteUrl = process.env.SITE_URL?.trim();
  if (siteUrl) {
    return siteUrl.replace(/\/+$/, "");
  }

  return getSiteUrl();
}

async function getUserIdByEmail(email: string) {
  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const result = await pool.query<{ id: number }>(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [email],
    );
    return result.rows[0];
  }

  const { db } = await import("@/lib/db");
  return db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(email) as { id: number } | undefined;
}

type CustomerPayload = {
  name?: string;
  email?: string;
  cpf?: string;
  phone?: string;
  whats?: string;
};

type IncomingOrderItem = {
  productId?: string;
  qty?: number;
};

async function getSessionEmailFromCookies() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("pf_session")?.value;
  if (!sessionToken) return "";

  try {
    const payload = jwt.verify(sessionToken, requireJwtSecret()) as {
      email?: string;
    };
    return normEmail(payload.email);
  } catch {
    return "";
  }
}

async function getOrCreateUserIdFromCustomerJson(
  customerJson: string,
  sessionEmail: string,
) {
  const customer = safeParse<CustomerPayload>(customerJson);
  const email = normEmail(customer?.email);
  if (!email || !email.includes("@")) return null;

  const existing = await getUserIdByEmail(email);

  const cpf = customer?.cpf ? onlyDigits(String(customer.cpf)) : null;
  if (cpf && !isValidCPF(cpf)) {
    if (existing?.id) {
      if (!sessionEmail || sessionEmail !== email) {
        return { userId: null, requiresLogin: true, email };
      }

      return { userId: existing.id, requiresLogin: false, email };
    }

    return createUserWithoutCPF(email, customer);
  }

  if (existing?.id) {
    if (!sessionEmail || sessionEmail !== email) {
      return { userId: null, requiresLogin: true, email };
    }

    if (cpf) {
      if (hasPostgresConfig()) {
        const pool = getPostgresPool();
        await pool.query(
          `UPDATE users
           SET cpf = COALESCE(cpf, $1)
           WHERE id = $2 AND (cpf IS NULL OR cpf = '')`,
          [cpf, existing.id],
        );
      } else {
        const { db } = await import("@/lib/db");
        db.prepare(
          `UPDATE users SET cpf = COALESCE(cpf, ?) WHERE id = ? AND (cpf IS NULL OR cpf = '')`,
        ).run(cpf, existing.id);
      }
    }
    return { userId: existing.id, requiresLogin: false, email };
  }

  const name = customer?.name ? String(customer.name).trim() : null;
  const phone = customer?.phone
    ? String(customer.phone).trim()
    : customer?.whats
      ? String(customer.whats).trim()
      : null;

  let insertedId = 0;
  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const result = await pool.query<{ id: number }>(
      `
      INSERT INTO users (email, name, phone, cpf, password_hash)
      VALUES ($1, $2, $3, $4, '')
      RETURNING id
      `,
      [email, name, phone, cpf],
    );
    insertedId = result.rows[0]?.id ?? 0;
  } else {
    const { db } = await import("@/lib/db");
    const info = db
      .prepare(
        `
        INSERT INTO users (email, name, phone, cpf, password_hash)
        VALUES (?, ?, ?, ?, '')
        `,
      )
      .run(email, name, phone, cpf);
    insertedId = Number(info.lastInsertRowid);
  }

  return {
    userId: insertedId,
    requiresLogin: false,
    email,
    createdNewUser: true,
    customer,
  };
}

async function createUserWithoutCPF(email: string, customer: CustomerPayload | null) {
  const name = customer?.name ? String(customer.name).trim() : null;
  const phone = customer?.phone
    ? String(customer.phone).trim()
    : customer?.whats
      ? String(customer.whats).trim()
      : null;

  let insertedId = 0;
  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const result = await pool.query<{ id: number }>(
      `INSERT INTO users (email, name, phone, password_hash)
       VALUES ($1, $2, $3, '')
       RETURNING id`,
      [email, name, phone],
    );
    insertedId = result.rows[0]?.id ?? 0;
  } else {
    const { db } = await import("@/lib/db");
    const info = db
      .prepare(
        `INSERT INTO users (email, name, phone, password_hash) VALUES (?, ?, ?, '')`,
      )
      .run(email, name, phone);
    insertedId = Number(info.lastInsertRowid);
  }

  return {
    userId: insertedId,
    requiresLogin: false,
    email,
    createdNewUser: true,
    customer,
  };
}

function resolveShippingAmount(body: Record<string, unknown>, subtotal: number) {
  const address =
    body.address && typeof body.address === "object"
      ? (body.address as Record<string, unknown>)
      : null;

  const cep = onlyDigits(String(address?.cep || ""));
  const shipping = calculateMockShipping(subtotal, cep);

  if (shipping.error) {
    return {
      ok: false as const,
      error: shipping.error,
    };
  }

  return {
    ok: true as const,
    amount: Number(shipping.price || 0),
  };
}

async function getAuthorizedEmail(req: Request) {
  const url = new URL(req.url);
  const lookupToken = url.searchParams.get("lookupToken");

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("pf_session")?.value;

  if (sessionToken) {
    try {
      const payload = jwt.verify(sessionToken, requireJwtSecret()) as {
        email?: string;
      };
      const sessionEmail = normEmail(payload.email);
      if (sessionEmail) return sessionEmail;
    } catch {}
  }

  const lookup = verifyOrderLookupToken(lookupToken);
  return lookup?.email || "";
}

export async function GET(req: Request) {
  try {
    ensureJwtSecret();
  } catch {
    return NextResponse.json(
      { ok: false, error: "server_not_configured" },
      { status: 500 },
    );
  }

  const lookupToken = new URL(req.url).searchParams.get("lookupToken");
  const lookup = verifyOrderLookupToken(lookupToken);
  const email = await getAuthorizedEmail(req);
  if (!email) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  let rows: Array<Record<string, unknown>> = [];
  try {
    if (hasPostgresConfig()) {
      const pool = getPostgresPool();
      const result = await pool.query<Record<string, unknown>>(
        `
        SELECT
          id,
          createdat AS "createdAt",
          status,
          paymentmethod AS "paymentMethod",
          paymentjson AS "paymentJson",
          customerjson AS "customerJson",
          customeremail AS "customerEmail",
          addressjson AS "addressJson",
          itemsjson AS "itemsJson",
          subtotal,
          shippingamount AS "shippingAmount",
          total,
          user_id
        FROM orders
        WHERE lower(customeremail) = $1
          AND ($2::text IS NULL OR id = $2)
        ORDER BY createdat DESC
        `,
        [email, lookup?.orderId || null],
      );
      rows = result.rows;
    } else {
      const { db } = await import("@/lib/db");
      rows = db
        .prepare(
          `
          SELECT *
          FROM orders
          WHERE lower(json_extract(customerJson, '$.email')) = ?
            AND (? IS NULL OR id = ?)
          ORDER BY createdAt DESC
          `,
        )
        .all(email, lookup?.orderId || null, lookup?.orderId || null) as Array<Record<string, unknown>>;
    }
  } catch {
    if (hasPostgresConfig()) {
      const pool = getPostgresPool();
      const result = await pool.query<Record<string, unknown>>(
        `
        SELECT
          id,
          createdat AS "createdAt",
          status,
          paymentmethod AS "paymentMethod",
          paymentjson AS "paymentJson",
          customerjson AS "customerJson",
          customeremail AS "customerEmail",
          addressjson AS "addressJson",
          itemsjson AS "itemsJson",
          subtotal,
          shippingamount AS "shippingAmount",
          total,
          user_id
        FROM orders
        WHERE lower(customerjson) LIKE lower($1)
          AND ($2::text IS NULL OR id = $2)
        ORDER BY createdat DESC
        `,
        [`%"email":"${email}"%`, lookup?.orderId || null],
      );
      rows = result.rows;
    } else {
      const { db } = await import("@/lib/db");
      const needle = `%"email":"${email}"%`;
      rows = db
        .prepare(
          `
          SELECT *
          FROM orders
          WHERE lower(customerJson) LIKE lower(?)
            AND (? IS NULL OR id = ?)
          ORDER BY createdAt DESC
          `,
        )
        .all(needle, lookup?.orderId || null, lookup?.orderId || null) as Array<Record<string, unknown>>;
    }
  }

  const orders = rows.map((row) => ({
    id: row.id,
    createdAt: Number(row.createdAt),
    status: row.status,
    paymentMethod: row.paymentMethod,
    subtotal: Number(row.subtotal || 0),
    shippingAmount: Number(row.shippingAmount || 0),
    total: Number(row.total || 0),
    user_id: row.user_id ?? null,
    payment: safeParse(row.paymentJson),
    customer: safeParse(row.customerJson),
    address: safeParse(row.addressJson),
    items: safeParse(row.itemsJson) || [],
  }));

  return NextResponse.json({ ok: true, orders });
}

export async function POST(req: Request) {
  const csrfError = validateCsrfRequest(req);
  if (csrfError) {
    return csrfError;
  }

  try {
    ensureJwtSecret();
  } catch {
    return NextResponse.json(
      { ok: false, error: "server_not_configured" },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => null);
  const orderId = createServerOrderId();
  const createdAt = Date.now();

  if (!body?.customer?.email) {
    return NextResponse.json(
      { ok: false, error: "customer.email obrigatorio" },
      { status: 400 },
    );
  }
  if (!Array.isArray(body?.items) || body.items.length === 0) {
    return NextResponse.json(
      { ok: false, error: "items obrigatorio" },
      { status: 400 },
    );
  }

  const incoming = (body.items as IncomingOrderItem[]).map((item) => ({
    productId: String(item.productId ?? ""),
    qty: Math.max(1, Math.floor(Number(item.qty ?? 1))),
  }));

  if (incoming.some((item) => !item.productId)) {
    return NextResponse.json(
      { ok: false, error: "invalid_items" },
      { status: 400 },
    );
  }

  const itemsSnapshot: Array<{
    productId: string;
    slug: string;
    title: string;
    unitPrice: number;
    qty: number;
    image: string | null;
  }> = [];

  let subtotalForDb = 0;

  for (const item of incoming) {
    let row:
      | {
          id: string;
          slug: string;
          name: string;
          price: number;
          active: number;
          stock: number;
          cover?: string | null;
        }
      | undefined;

    if (hasPostgresConfig()) {
      const pool = getPostgresPool();
      const result = await pool.query<{
        id: string;
        slug: string;
        name: string;
        price: number;
        active: number;
        stock: number;
        cover?: string | null;
      }>(
        `
        SELECT
          p.id, p.slug, p.name, p.price, p.active, p.stock,
          (
            SELECT url
            FROM product_images
            WHERE productid = p.id
            ORDER BY sortorder ASC
            LIMIT 1
          ) AS cover
        FROM products p
        WHERE p.id = $1
        LIMIT 1
        `,
        [item.productId],
      );
      row = result.rows[0];
    } else {
      const { db } = await import("@/lib/db");
      row = db
        .prepare(
          `
          SELECT
            p.id, p.slug, p.name, p.price, p.active, p.stock,
            (SELECT url FROM product_images WHERE productId = p.id ORDER BY sortOrder ASC LIMIT 1) AS cover
          FROM products p
          WHERE p.id = ?
          LIMIT 1
          `,
        )
        .get(item.productId) as
        | {
            id: string;
            slug: string;
            name: string;
            price: number;
            active: number;
            stock: number;
            cover?: string | null;
          }
        | undefined;
    }

    if (!row) {
      return NextResponse.json(
        { ok: false, error: "product_not_found", productId: item.productId },
        { status: 400 },
      );
    }

    if (Number(row.active) !== 1) {
      return NextResponse.json(
        { ok: false, error: "product_inactive", productId: item.productId },
        { status: 400 },
      );
    }

    const stock = Number(row.stock ?? 0);
    if (stock < item.qty) {
      return NextResponse.json(
        {
          ok: false,
          error: "insufficient_stock",
          productId: item.productId,
          stock,
        },
        { status: 400 },
      );
    }

    const unitPrice = Number(row.price || 0);
    subtotalForDb += unitPrice * item.qty;

    itemsSnapshot.push({
      productId: String(row.id),
      slug: String(row.slug),
      title: String(row.name),
      unitPrice,
      qty: item.qty,
      image: row.cover ? String(row.cover) : null,
    });
  }

  const shippingResult = resolveShippingAmount(
    body as Record<string, unknown>,
    subtotalForDb,
  );

  if (!shippingResult.ok) {
    return NextResponse.json(
      { ok: false, error: shippingResult.error },
      { status: 400 },
    );
  }

  const shipping = shippingResult.amount;
  const totalForDb = subtotalForDb + shipping;

  const customerJson = JSON.stringify(body.customer);
  const customerEmail = normEmail(body?.customer?.email);
  const sessionEmail = await getSessionEmailFromCookies();
  const userResolution = await getOrCreateUserIdFromCustomerJson(customerJson, sessionEmail);

  if (userResolution?.requiresLogin) {
    return NextResponse.json(
      {
        ok: false,
        error: "account_login_required",
        reason:
          "Esse email já está vinculado a uma conta. Entre com sua senha ou redefina o acesso para continuar.",
      },
      { status: 409 },
    );
  }

  const userId = userResolution?.userId ?? null;

  const rateLimit = await consumeRateLimit({
    scope: "orders-create",
    key: `${getRequestIp(req)}:${customerEmail || "sem-email"}`,
    limit: 8,
    windowMs: 30 * 60 * 1000,
  });

  if (!rateLimit.ok) {
    return NextResponse.json(
      { ok: false, error: "Muitas tentativas de pedido. Aguarde alguns minutos." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)),
        },
      },
    );
  }

  const paymentMethod = String(body.paymentMethod || "pix_auto");
  if (paymentMethod === "card_stripe") {
    const stripe = getStripeStatus();
    if (!stripe.checkoutReady) {
      return NextResponse.json(
        {
          ok: false,
          error: "stripe_not_ready",
        },
        { status: 400 },
      );
    }
  }
  if (paymentMethod === "card_mercadopago") {
    const mercadoPago = getMercadoPagoStatus();
    if (!mercadoPago.checkoutReady) {
      return NextResponse.json(
        {
          ok: false,
          error: "mercadopago_not_ready",
        },
        { status: 400 },
      );
    }
  }

  if (!["pix_auto", "card_stripe", "card_mercadopago"].includes(paymentMethod)) {
    return NextResponse.json(
      { ok: false, error: "unsupported_payment_method" },
      { status: 400 },
    );
  }
  let payment = body.payment ?? null;
  const orderAccessToken = createOrderLookupToken(customerEmail, orderId);

  if (paymentMethod === "pix_auto") {
    const baseUrl = getPublicBaseUrl(req);
    const webhookSecret = requireConfiguredSecret("PUSHINPAY_WEBHOOK_SECRET");
    const webhookUrl = webhookSecret
      ? `${baseUrl}/api/webhooks/pushinpay?token=${encodeURIComponent(webhookSecret)}`
      : `${baseUrl}/api/webhooks/pushinpay`;

    const totalCents = Math.round(Number(totalForDb || 0) * 100);
    let cashin;
    try {
      cashin = await pushinpayCreatePixCashIn(totalCents, webhookUrl);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "unknown_error";
      if (message === "pushinpay_minimum_value_50") {
        return NextResponse.json(
          {
            ok: false,
            error: "pix_minimum_value",
            reason: "O valor minimo para gerar Pix automatico e de R$ 0,50.",
          },
          { status: 400 },
        );
      }

      throw error;
    }
    payment = {
      method: "pix_auto",
      provider: "pushinpay",
      pushinpayTransactionId: cashin.id,
      pixCopiaECola: cashin.qr_code,
      qrBase64: cashin.qr_code_base64 ?? null,
      status: cashin.status,
    };
  }

  let checkoutUrl: string | null = null;

  if (paymentMethod === "card_stripe") {
    const baseUrl = getPublicBaseUrl(req);
    const stripe = getStripeClient();
    const lineItems = itemsSnapshot.map((item) => ({
      quantity: item.qty,
      price_data: {
        currency: "brl",
        unit_amount: Math.round(item.unitPrice * 100),
        product_data: {
          name: item.title,
        },
      },
    }));

    if (shipping > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "brl",
          unit_amount: Math.round(shipping * 100),
          product_data: {
            name: "Frete",
          },
        },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: customerEmail || undefined,
      line_items: lineItems,
      success_url: `${baseUrl}/pedidos/sucesso?id=${encodeURIComponent(orderId)}&access=${encodeURIComponent(orderAccessToken)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout`,
      metadata: {
        orderId,
      },
    });

    checkoutUrl = session.url;
    payment = {
      method: "card_stripe",
      provider: "stripe",
      stripeSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : null,
      checkoutUrl,
      status: session.payment_status || session.status,
    };
  }

  if (paymentMethod === "card_mercadopago") {
    const baseUrl = getPublicBaseUrl(req);
    const webhookUrl = `${baseUrl}/api/webhooks/mercadopago`;

    const successBase =
      `${baseUrl}/pedidos/sucesso?id=${encodeURIComponent(orderId)}` +
      `&access=${encodeURIComponent(orderAccessToken)}`;

    const preference = await createMercadoPagoPreference({
      orderId,
      payerEmail: customerEmail || undefined,
      notificationUrl: webhookUrl,
      successUrl: `${successBase}&payment_id={payment_id}&status={status}`,
      pendingUrl: `${successBase}&payment_id={payment_id}&status={status}`,
      failureUrl: `${successBase}&payment_id={payment_id}&status={status}`,
      items: [
        ...itemsSnapshot.map((item) => ({
          title: item.title,
          quantity: item.qty,
          unit_price: Number(item.unitPrice || 0),
        })),
        ...(shipping > 0
          ? [
              {
                title: "Frete",
                quantity: 1,
                unit_price: Number(shipping || 0),
              },
            ]
          : []),
      ],
    });

    checkoutUrl = preference.checkoutUrl;
    payment = {
      method: "card_mercadopago",
      provider: "mercadopago",
      mercadoPagoPreferenceId: preference.id,
      checkoutUrl,
      status: "pending",
    };
  }

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    await pool.query(
      `
      INSERT INTO orders (
        id, createdat, status, paymentmethod, paymentjson, customerjson,
        customeremail, addressjson, itemsjson, subtotal, shippingamount, total, user_id
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $13
      )
      `,
      [
        orderId,
        createdAt,
        String(body.status || "aguardando_pagamento"),
        paymentMethod,
        payment ? JSON.stringify(payment) : null,
        customerJson,
        customerEmail,
        body.address ? JSON.stringify(body.address) : null,
        JSON.stringify(itemsSnapshot),
        subtotalForDb,
        shipping,
        totalForDb,
        userId,
      ],
    );
  } else {
    const { db } = await import("@/lib/db");
    db.prepare(
      `
      INSERT INTO orders (
        id, createdAt, status, paymentMethod, paymentJson, customerJson,
        customerEmail, addressJson, itemsJson, subtotal, shippingAmount, total, user_id
      )
      VALUES (
        @id, @createdAt, @status, @paymentMethod, @paymentJson, @customerJson,
        @customerEmail, @addressJson, @itemsJson, @subtotal, @shippingAmount, @total, @user_id
      )
      `,
    ).run({
      id: orderId,
      createdAt,
      status: String(body.status || "aguardando_pagamento"),
      paymentMethod,
      paymentJson: payment ? JSON.stringify(payment) : null,
      customerJson,
      customerEmail,
      addressJson: body.address ? JSON.stringify(body.address) : null,
      itemsJson: JSON.stringify(itemsSnapshot),
      subtotal: subtotalForDb,
      shippingAmount: shipping,
      total: totalForDb,
      user_id: userId,
    });
  }

  if (paymentMethod === "pix_auto") {
    try {
      await sendNewOrderAdminEmail({
        id: orderId,
        total: totalForDb,
        paymentMethod,
        createdAt,
        customer: {
          name: String(body?.customer?.name || "").trim() || undefined,
          email: customerEmail || undefined,
        },
      });
    } catch (error) {
      console.error("[orders:new-order-admin-email] error", error);
    }
  }

  if (
    userResolution &&
    "createdNewUser" in userResolution &&
    userResolution.createdNewUser &&
    customerEmail
  ) {
    try {
      const siteUrl = process.env.SITE_URL || new URL(req.url).origin;
      const token = createEmailVerificationToken(customerEmail);
      const verifyUrl = `${siteUrl}/verificar-email?token=${encodeURIComponent(token)}`;
      const customerName = escapeHtml(
        String(userResolution.customer?.name || "").trim() || "Oi",
      );
      const safeVerifyUrl = sanitizeEmailUrl(verifyUrl);

      await sendEmail({
        to: customerEmail,
        subject: "Confirme seu email - Papelaria Felicio",
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6">
            <h2>Seu pedido foi recebido</h2>
            <p>${customerName}, também criamos sua conta para facilitar seus próximos pedidos.</p>
            <p>Para ativar o acesso, confirme seu email neste link:</p>
            <p><a href="${safeVerifyUrl}">${escapeHtml(safeVerifyUrl)}</a></p>
            <p>Depois disso, você poderá definir ou recuperar sua senha quando quiser.</p>
            <hr />
            <p style="color:#666;font-size:12px">Papelaria Felicio</p>
          </div>
        `,
      });
    } catch (error) {
      console.error("[orders:email-verification] error", error);
    }
  }

  try {
    if (userId && body?.address) {
      const address = body.address;
      const zip = String(address.cep || address.zip || "").replace(/\D/g, "");
      const street = String(address.street || "").trim();
      const number = String(address.number || "").trim();
      const city = String(address.city || "").trim();
      const uf = String(address.uf || "").trim().toUpperCase();

      if (zip.length === 8 && street && number && city && uf) {
        const now = Date.now();
        if (hasPostgresConfig()) {
          const pool = getPostgresPool();
          const client = await pool.connect();
          try {
            await client.query("BEGIN");
            await client.query(
              `UPDATE customer_addresses SET isdefault = 0 WHERE user_id = $1`,
              [userId],
            );
            await client.query(
              `
              INSERT INTO customer_addresses (
                id, user_id, label, recipientname, phone,
                zip, street, number, complement, district, city, uf,
                isdefault, createdat, updatedat
              ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10, $11, $12,
                1, $13, $14
              )
              `,
              [
                crypto.randomUUID(),
                userId,
                "Entrega",
                String(body?.customer?.name || "").trim() || null,
                String(body?.customer?.whats || body?.customer?.phone || "").trim() ||
                  null,
                zip,
                street,
                number,
                String(address.complement || "").trim() || null,
                String(address.district || "").trim() || null,
                city,
                uf,
                now,
                now,
              ],
            );
            await client.query("COMMIT");
          } catch (innerError) {
            await client.query("ROLLBACK");
            throw innerError;
          } finally {
            client.release();
          }
        } else {
          const { db } = await import("@/lib/db");
          const tx = db.transaction(() => {
            db.prepare(
              `UPDATE customer_addresses SET isDefault = 0 WHERE user_id = ?`,
            ).run(userId);

            db.prepare(
              `
              INSERT INTO customer_addresses (
                id, user_id, label, recipientName, phone,
                zip, street, number, complement, district, city, uf,
                isDefault, createdAt, updatedAt
              ) VALUES (
                lower(hex(randomblob(16))), ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?,
                1, ?, ?
              )
              `,
            ).run(
              userId,
              "Entrega",
              String(body?.customer?.name || "").trim() || null,
              String(body?.customer?.whats || body?.customer?.phone || "").trim() || null,
              zip,
              street,
              number,
              String(address.complement || "").trim() || null,
              String(address.district || "").trim() || null,
              city,
              uf,
              now,
              now,
            );
          });

          tx();
        }
      }
    }
  } catch (error) {
    console.error("Falha ao salvar endereco do cliente:", error);
  }

  const res = NextResponse.json({
    ok: true,
    orderId,
    user_id: userId,
    checkoutUrl,
    orderAccessToken,
  });

  res.cookies.set("pf_order_lookup", orderAccessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });

  return res;
}
