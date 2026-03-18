import { onlyDigits } from "@/lib/validators";
import { getOlistConfig } from "@/lib/olist";
import { getPostgresPool, hasPostgresConfig } from "@/lib/postgres";

type JsonRecord = Record<string, unknown>;

type StoredOrderRow = {
  id: string;
  createdAt: number;
  paymentMethod: string;
  paymentJson: string | null;
  customerJson: string;
  addressJson: string | null;
  itemsJson: string;
  shippingAmount: number;
  subtotal: number;
  total: number;
};

type OrderItemRow = {
  productId?: string;
  title?: string;
  unitPrice?: number;
  qty?: number;
};

type ProductCodeRow = {
  id: string;
  externalSku: string | null;
  sku: string | null;
};

type TinySyncState = {
  tinyOrderId?: string | number | null;
  tinyOrderNumber?: string | number | null;
  tinyOrderStatus?: string | null;
  tinySyncedAt?: number | null;
  tinySyncError?: string | null;
};

type SyncTinyOrderResult =
  | { ok: true; skipped: true; reason: string; tinyOrderId?: string | number | null }
  | {
      ok: true;
      skipped: false;
      tinyOrderId: string | number;
      tinyOrderNumber?: string | number | null;
      approved: boolean;
    }
  | { ok: false; skipped: false; reason: string; message: string };

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function safeParseRecord(value: string | null): JsonRecord | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return asRecord(parsed);
  } catch {
    return null;
  }
}

function safeParseItems(value: string | null): OrderItemRow[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as OrderItemRow[]) : [];
  } catch {
    return [];
  }
}

function cleanObject<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => cleanObject(entry)) as T;
  }

  const record = asRecord(value);
  if (!record) return value;

  const next: JsonRecord = {};
  for (const [key, entry] of Object.entries(record)) {
    if (entry === undefined || entry === null || entry === "") continue;

    if (Array.isArray(entry)) {
      const cleaned = entry
        .map((row) => cleanObject(row))
        .filter((row) => {
          if (row === undefined || row === null || row === "") return false;
          if (Array.isArray(row)) return row.length > 0;
          const rowRecord = asRecord(row);
          return rowRecord ? Object.keys(rowRecord).length > 0 : true;
        });

      if (cleaned.length > 0) {
        next[key] = cleaned;
      }
      continue;
    }

    const entryRecord = asRecord(entry);
    if (entryRecord) {
      const cleaned = cleanObject(entryRecord);
      if (Object.keys(cleaned as JsonRecord).length > 0) {
        next[key] = cleaned;
      }
      continue;
    }

    next[key] = entry;
  }

  return next as T;
}

function formatTinyDate(timestamp: number) {
  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
}

function toTinyDecimal(value: number) {
  return Number(Number(value || 0).toFixed(2));
}

function inferTinyOrderCreateUrl(productsUrl: string) {
  if (!productsUrl.includes("api.tiny.com.br/api2/")) return "";
  return "https://api.tiny.com.br/api2/pedido.incluir.php";
}

function inferTinyOrderApproveUrl(productsUrl: string) {
  if (!productsUrl.includes("api.tiny.com.br/api2/")) return "";
  return "https://api.tiny.com.br/api2/pedido.alterar.situacao";
}

function parseTinyError(payload: unknown) {
  const root = asRecord(payload);
  const retorno = root ? asRecord(root.retorno) : null;
  const status = String(retorno?.status || "").trim().toLowerCase();

  if (status === "erro") {
    const errors = retorno?.erros;
    if (Array.isArray(errors)) {
      const message = errors
        .map(asRecord)
        .filter(Boolean)
        .map((row) => String(row?.erro || row?.message || "").trim())
        .filter(Boolean)
        .join(" | ");
      if (message) return message;
    }

    const errorRecord = retorno?.error ? asRecord(retorno.error) : null;
    if (errorRecord) {
      const message = String(errorRecord.erro || errorRecord.message || "").trim();
      if (message) return message;
    }

    return "Tiny retornou erro ao processar o pedido.";
  }

  return "";
}

async function postTinyForm<T>(url: string, params: URLSearchParams) {
  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: params.toString(),
  });

  const text = await response.text().catch(() => "");
  let payload: T | null = null;

  if (text) {
    try {
      payload = JSON.parse(text) as T;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const snippet = text.trim().replace(/\s+/g, " ").slice(0, 240);
    throw new Error(`Falha ao consultar Tiny (${response.status})${snippet ? `: ${snippet}` : "."}`);
  }

  const tinyError = parseTinyError(payload);
  if (tinyError) {
    throw new Error(tinyError);
  }

  return payload;
}

function parseTinyCreatedOrder(payload: unknown) {
  const root = asRecord(payload);
  const retorno = root ? asRecord(root.retorno) : null;

  const directId = retorno?.id;
  const directNumber = retorno?.numero;
  if (directId || directNumber) {
    return {
      id: String(directId || "").trim(),
      number: String(directNumber || "").trim() || null,
    };
  }

  const registros = retorno?.registros;
  if (!Array.isArray(registros)) return null;

  for (const item of registros) {
    const row = asRecord(item);
    const registro = row?.registro ? asRecord(row.registro) : null;
    if (!registro) continue;

    const id = String(registro.id || "").trim();
    const number = String(registro.numero || "").trim() || null;
    if (id) {
      return { id, number };
    }
  }

  return null;
}

async function getStoredOrder(orderId: string): Promise<StoredOrderRow | undefined> {
  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const result = await pool.query<StoredOrderRow>(
      `
      SELECT
        id,
        createdat AS "createdAt",
        paymentmethod AS "paymentMethod",
        paymentjson AS "paymentJson",
        customerjson AS "customerJson",
        addressjson AS "addressJson",
        itemsjson AS "itemsJson",
        shippingamount AS "shippingAmount",
        subtotal,
        total
      FROM orders
      WHERE id = $1
      LIMIT 1
      `,
      [orderId],
    );
    return result.rows[0];
  }

  const { db } = await import("@/lib/db");
  return db
    .prepare(
      `
      SELECT
        id,
        createdAt,
        paymentMethod,
        paymentJson,
        customerJson,
        addressJson,
        itemsJson,
        shippingAmount,
        subtotal,
        total
      FROM orders
      WHERE id = ?
      LIMIT 1
      `,
    )
    .get(orderId) as StoredOrderRow | undefined;
}

async function getProductCodes(productIds: string[]) {
  if (productIds.length === 0) return new Map<string, ProductCodeRow>();

  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const result = await pool.query<ProductCodeRow>(
      `
      SELECT
        id,
        externalsku AS "externalSku",
        sku
      FROM products
      WHERE id = ANY($1::text[])
      `,
      [productIds],
    );

    return new Map(result.rows.map((row) => [String(row.id), row]));
  }

  const { db } = await import("@/lib/db");
  const placeholders = productIds.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `
      SELECT
        id,
        externalSku,
        sku
      FROM products
      WHERE id IN (${placeholders})
      `,
    )
    .all(...productIds) as ProductCodeRow[];

  return new Map(rows.map((row) => [String(row.id), row]));
}

async function updateOrderPaymentPatch(orderId: string, patch: TinySyncState) {
  if (hasPostgresConfig()) {
    const pool = getPostgresPool();
    const currentResult = await pool.query<{ paymentJson: string | null }>(
      `SELECT paymentjson AS "paymentJson" FROM orders WHERE id = $1 LIMIT 1`,
      [orderId],
    );
    const currentPayment = safeParseRecord(currentResult.rows[0]?.paymentJson ?? null) || {};
    const nextPayment = { ...currentPayment, ...patch };

    await pool.query(`UPDATE orders SET paymentjson = $1 WHERE id = $2`, [
      JSON.stringify(nextPayment),
      orderId,
    ]);
    return;
  }

  const { db } = await import("@/lib/db");
  const row = db
    .prepare(`SELECT paymentJson FROM orders WHERE id = ? LIMIT 1`)
    .get(orderId) as { paymentJson?: string | null } | undefined;
  const currentPayment = safeParseRecord(row?.paymentJson ?? null) || {};
  const nextPayment = { ...currentPayment, ...patch };
  db.prepare(`UPDATE orders SET paymentJson = ? WHERE id = ?`).run(
    JSON.stringify(nextPayment),
    orderId,
  );
}

function paymentMethodLabel(method: string) {
  if (method === "pix_auto") return "Pix";
  if (method === "card_mercadopago") return "Cartao Mercado Pago";
  return method || "Nao informado";
}

function buildTinyOrderPayload(order: StoredOrderRow, productCodes: Map<string, ProductCodeRow>) {
  const customer = safeParseRecord(order.customerJson) || {};
  const address = safeParseRecord(order.addressJson) || {};
  const items = safeParseItems(order.itemsJson);

  const tinyItems = items.map((item) => {
    const productId = String(item.productId || "").trim();
    const product = productCodes.get(productId);
    const code = String(product?.externalSku || product?.sku || productId).trim();

    return {
      item: cleanObject({
        codigo: code,
        descricao: String(item.title || "Produto").trim(),
        unidade: "UN",
        quantidade: toTinyDecimal(Number(item.qty || 0)),
        valor_unitario: toTinyDecimal(Number(item.unitPrice || 0)),
      }),
    };
  });

  const cpf = onlyDigits(String(customer.cpf || ""));
  const phone = String(customer.phone || customer.whats || "").trim();
  const recipientName =
    String(address.recipientName || customer.name || "").trim() || undefined;

  return cleanObject({
    pedido: {
      data_pedido: formatTinyDate(Number(order.createdAt || Date.now())),
      cliente: {
        nome: String(customer.name || "Cliente do site").trim(),
        tipo_pessoa: cpf ? "F" : undefined,
        cpf_cnpj: cpf || undefined,
        endereco: String(address.street || "").trim() || undefined,
        numero: String(address.number || "").trim() || undefined,
        complemento: String(address.complement || "").trim() || undefined,
        bairro: String(address.district || "").trim() || undefined,
        cep: onlyDigits(String(address.cep || "")) || undefined,
        cidade: String(address.city || "").trim() || undefined,
        uf: String(address.uf || "").trim().toUpperCase() || undefined,
        fone: phone || undefined,
        email: String(customer.email || "").trim() || undefined,
        atualizar_cliente: "S",
      },
      endereco_entrega:
        Object.keys(address).length > 0
          ? {
              nome_destinatario: recipientName,
              tipo_pessoa: cpf ? "F" : undefined,
              cpf_cnpj: cpf || undefined,
              endereco: String(address.street || "").trim() || undefined,
              numero: String(address.number || "").trim() || undefined,
              complemento: String(address.complement || "").trim() || undefined,
              bairro: String(address.district || "").trim() || undefined,
              cep: onlyDigits(String(address.cep || "")) || undefined,
              cidade: String(address.city || "").trim() || undefined,
              uf: String(address.uf || "").trim().toUpperCase() || undefined,
              fone: phone || undefined,
            }
          : undefined,
      itens: tinyItems,
      meio_pagamento: paymentMethodLabel(order.paymentMethod),
      valor_frete:
        Number(order.shippingAmount || 0) > 0
          ? toTinyDecimal(Number(order.shippingAmount || 0))
          : undefined,
      frete_por_conta: Number(order.shippingAmount || 0) > 0 ? "R" : undefined,
      obs: `Pedido aprovado automaticamente pelo site Papelaria Felicio. Total: R$ ${Number(
        order.total || 0,
      ).toFixed(2)}.`,
      numero_pedido_ecommerce: order.id,
      ecommerce: "Papelaria Felicio",
      marcadores: [{ marcador: { descricao: "Site" } }],
    },
  });
}

async function createTinyOrder(token: string, createUrl: string, orderPayload: JsonRecord) {
  const params = new URLSearchParams();
  params.set("token", token);
  params.set("formato", "JSON");
  params.set("pedido", JSON.stringify(orderPayload));

  const payload = await postTinyForm<unknown>(createUrl, params);
  const created = parseTinyCreatedOrder(payload);

  if (!created?.id) {
    throw new Error("Tiny nao retornou o identificador do pedido criado.");
  }

  return created;
}

async function approveTinyOrder(token: string, approveUrl: string, tinyOrderId: string | number) {
  const params = new URLSearchParams();
  params.set("token", token);
  params.set("formato", "JSON");
  params.set("id", String(tinyOrderId));
  params.set("situacao", "aprovado");
  await postTinyForm<unknown>(approveUrl, params);
}

export async function syncApprovedOrderToTiny(orderId: string): Promise<SyncTinyOrderResult> {
  const config = getOlistConfig();
  if (config.mode !== "tiny") {
    return { ok: true, skipped: true, reason: "tiny_mode_not_enabled" };
  }

  const token = String(config.token || "").trim();
  const createUrl =
    String(process.env.OLIST_ORDER_CREATE_URL || "").trim() ||
    inferTinyOrderCreateUrl(config.productsUrl);
  const approveUrl =
    String(process.env.OLIST_ORDER_APPROVE_URL || "").trim() ||
    inferTinyOrderApproveUrl(config.productsUrl);

  if (!token || !createUrl || !approveUrl) {
    return { ok: true, skipped: true, reason: "tiny_order_endpoints_missing" };
  }

  const order = await getStoredOrder(orderId);
  if (!order) {
    return {
      ok: false,
      skipped: false,
      reason: "order_not_found",
      message: "Pedido nao localizado para envio ao Tiny.",
    };
  }

  const payment = safeParseRecord(order.paymentJson);
  const syncState = (payment || {}) as TinySyncState & JsonRecord;

  if (syncState.tinyOrderId && syncState.tinyOrderStatus === "aprovado") {
    return {
      ok: true,
      skipped: true,
      reason: "already_synced",
      tinyOrderId: syncState.tinyOrderId,
    };
  }

  try {
    let tinyOrderId = syncState.tinyOrderId ? String(syncState.tinyOrderId) : "";
    let tinyOrderNumber = syncState.tinyOrderNumber ?? null;

    if (!tinyOrderId) {
      const items = safeParseItems(order.itemsJson);
      const productIds = items
        .map((item) => String(item.productId || "").trim())
        .filter(Boolean);
      const productCodes = await getProductCodes(productIds);
      const payload = buildTinyOrderPayload(order, productCodes);
      const created = await createTinyOrder(token, createUrl, payload);
      tinyOrderId = String(created.id);
      tinyOrderNumber = created.number;

      await updateOrderPaymentPatch(order.id, {
        tinyOrderId,
        tinyOrderNumber,
        tinyOrderStatus: "incluido",
        tinySyncedAt: Date.now(),
        tinySyncError: null,
      });
    }

    await approveTinyOrder(token, approveUrl, tinyOrderId);

    await updateOrderPaymentPatch(order.id, {
      tinyOrderId,
      tinyOrderNumber,
      tinyOrderStatus: "aprovado",
      tinySyncedAt: Date.now(),
      tinySyncError: null,
    });

    return {
      ok: true,
      skipped: false,
      tinyOrderId,
      tinyOrderNumber,
      approved: true,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha desconhecida ao enviar pedido ao Tiny.";

    await updateOrderPaymentPatch(order.id, {
      tinyOrderId: syncState.tinyOrderId ?? null,
      tinyOrderNumber: syncState.tinyOrderNumber ?? null,
      tinyOrderStatus: syncState.tinyOrderStatus ?? null,
      tinySyncedAt: Date.now(),
      tinySyncError: message.slice(0, 500),
    });

    return {
      ok: false,
      skipped: false,
      reason: "tiny_sync_failed",
      message,
    };
  }
}
