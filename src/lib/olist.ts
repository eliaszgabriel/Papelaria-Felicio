type OlistPrimitiveRecord = Record<string, unknown>;

type OlistStockRow = {
  quantity?: unknown;
};

type TinySearchRow = {
  id: string;
  externalSku: string;
  name: string;
};

function normalizeTinyLookup(value: string) {
  return value.trim().toLowerCase();
}

function isRecord(value: OlistPrimitiveRecord | null): value is OlistPrimitiveRecord {
  return Boolean(value);
}

export type OlistProductInput = {
  externalSku: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  active: boolean;
  photoUrl?: string | null;
};

export type OlistConfig = {
  mode: "partners" | "tiny";
  idToken: string;
  token: string;
  productsUrl: string;
  productDetailsUrl: string;
  productStockUrl: string;
  productsQuery: string;
  useStockEndpoint: boolean;
};

export type FetchOlistProductsOptions = {
  page?: number;
  offset?: number;
  batchSize?: number;
  query?: string;
  forceStockEndpoint?: boolean;
};

export type FetchOlistProductsResult = {
  items: OlistProductInput[];
  page: number;
  offset: number;
  nextPage: number;
  nextOffset: number;
  batchSize: number;
  hasMore: boolean;
  mode: "partners" | "tiny";
};

export type TinyDebugResult = {
  query: string;
  matched: boolean;
  selectedRow: TinySearchRow | null;
  parsedDetail: OlistProductInput | null;
  parsedStock: number | null;
  rawSearch: unknown;
  rawDetail: unknown;
  rawStock: unknown;
};

function asRecord(value: unknown): OlistPrimitiveRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as OlistPrimitiveRecord)
    : null;
}

function asStockRow(value: unknown): OlistStockRow | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as OlistStockRow)
    : null;
}

function pickString(record: OlistPrimitiveRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function pickNumber(record: OlistPrimitiveRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const normalized = Number(value.replace(/\./g, "").replace(",", "."));
      if (Number.isFinite(normalized)) return normalized;
    }
  }
  return 0;
}

function pickBoolean(record: OlistPrimitiveRecord, keys: string[], fallback = true) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["1", "true", "ativo", "active", "sim", "yes", "a"].includes(normalized)) {
        return true;
      }
      if (["0", "false", "inativo", "inactive", "nao", "não", "no", "i"].includes(normalized)) {
        return false;
      }
    }
  }
  return fallback;
}

function pickPhotoUrl(record: OlistPrimitiveRecord) {
  const direct = pickString(record, [
    "photo",
    "imagem",
    "image",
    "foto",
    "foto_externa",
    "imagem_externa",
    "url_imagem",
    "urlImagem",
    "url_foto",
    "thumbnail",
  ]);
  if (direct) return direct;

  const collections = [
    record.photos,
    record.imagens,
    record.anexos,
    record.midias,
    record.attachments,
  ];

  for (const collection of collections) {
    if (!Array.isArray(collection)) continue;
    for (const entry of collection) {
      const row = asRecord(entry);
      if (!row) continue;

      const directUrl = pickString(row, [
        "url",
        "link",
        "imagem",
        "image",
        "foto",
        "thumbnail",
      ]);
      if (directUrl) return directUrl;

      const nestedKeys = ["foto", "imagem", "image", "anexo", "arquivo", "media"];
      for (const key of nestedKeys) {
        const nested = asRecord(row[key]);
        if (!nested) continue;
        const nestedUrl = pickString(nested, [
          "url",
          "link",
          "imagem",
          "image",
          "foto",
          "thumbnail",
        ]);
        if (nestedUrl) return nestedUrl;
      }
    }
  }

  return "";
}

function pickStockFromPartners(record: OlistPrimitiveRecord) {
  const direct = pickNumber(record, ["estoque", "stock", "quantidade", "saldo_estoque"]);
  if (direct > 0) return Math.max(0, Math.trunc(direct));

  const nestedStock = record.stock;
  if (Array.isArray(nestedStock)) {
    const total = nestedStock
      .map(asStockRow)
      .filter(Boolean)
      .reduce((sum, row) => {
        const value = row?.quantity;
        if (typeof value === "number" && Number.isFinite(value)) return sum + value;
        if (typeof value === "string") {
          const normalized = Number(value.replace(/\./g, "").replace(",", "."));
          if (Number.isFinite(normalized)) return sum + normalized;
        }
        return sum;
      }, 0);

    return Math.max(0, Math.trunc(total));
  }

  return 0;
}

function extractArray(payload: unknown): OlistPrimitiveRecord[] {
  if (Array.isArray(payload)) {
    return payload.map(asRecord).filter(Boolean) as OlistPrimitiveRecord[];
  }

  const root = asRecord(payload);
  if (!root) return [];

  const candidateKeys = ["items", "products", "produtos", "data", "result", "results"];
  for (const key of candidateKeys) {
    const value = root[key];
    if (Array.isArray(value)) {
      return value.map(asRecord).filter(Boolean) as OlistPrimitiveRecord[];
    }

    const nested = asRecord(value);
    if (!nested) continue;

    for (const nestedKey of candidateKeys) {
      const nestedValue = nested[nestedKey];
      if (Array.isArray(nestedValue)) {
        return nestedValue.map(asRecord).filter(Boolean) as OlistPrimitiveRecord[];
      }
    }
  }

  return [];
}

function inferTinyDetailsUrl(productsUrl: string) {
  if (!productsUrl.includes("api.tiny.com.br/api2/")) return "";
  return "https://api.tiny.com.br/api2/produto.obter.php";
}

function inferTinyStockUrl(productsUrl: string) {
  if (!productsUrl.includes("api.tiny.com.br/api2/")) return "";
  return "https://api.tiny.com.br/api2/produto.obter.estoque.php";
}

export function getOlistConfig(): OlistConfig {
  const productsUrl = process.env.OLIST_PRODUCTS_URL || "";
  const inferredTiny = productsUrl.includes("api.tiny.com.br/api2/");

  return {
    mode: inferredTiny ? "tiny" : "partners",
    idToken: process.env.OLIST_ID_TOKEN || "",
    token: process.env.OLIST_TOKEN || "",
    productsUrl,
    productDetailsUrl:
      process.env.OLIST_PRODUCT_DETAILS_URL || inferTinyDetailsUrl(productsUrl),
    productStockUrl: process.env.OLIST_PRODUCT_STOCK_URL || inferTinyStockUrl(productsUrl),
    productsQuery: process.env.OLIST_PRODUCTS_QUERY || "",
    useStockEndpoint: process.env.OLIST_USE_STOCK_ENDPOINT === "1",
  };
}

export function isOlistConfigured() {
  const config = getOlistConfig();
  if (config.mode === "tiny") {
    return Boolean(config.token && config.productsUrl && config.productDetailsUrl);
  }

  return Boolean(config.idToken && config.productsUrl);
}

function parseTinyError(payload: unknown) {
  const root = asRecord(payload);
  const retorno = root ? asRecord(root.retorno) : null;
  const status = retorno ? pickString(retorno, ["status"]) : "";

  if (status.toLowerCase() === "erro") {
    const errors = retorno?.erros;
    if (Array.isArray(errors)) {
      const message = errors
        .map(asRecord)
        .filter(isRecord)
        .map((row) => pickString(row, ["erro", "message"]))
        .filter(Boolean)
        .join(" | ");
      if (message) return message;
    }

    const errorRecord = retorno?.error ? asRecord(retorno.error) : null;
    if (errorRecord) {
      const message = pickString(errorRecord, ["erro", "message"]);
      if (message) return message;
    }

    return "Tiny retornou erro ao processar a requisicao.";
  }

  return "";
}

function parsePartnersProducts(payload: unknown) {
  const rows = extractArray(payload);

  return rows
    .map((row): OlistProductInput | null => {
      const externalSku = pickString(row, [
        "sku",
        "codigo",
        "codigo_sku",
        "codigoSku",
        "productCode",
        "product_code",
        "codigo_produto",
      ]);
      const name = pickString(row, ["nome", "name", "descricao", "description"]);
      if (!externalSku || !name) return null;

      return {
        externalSku,
        name,
        description:
          pickString(row, ["descricao_completa", "descricao", "description"]) || null,
        price: pickNumber(row, ["offer", "preco", "price", "valor", "valor_venda"]),
        stock: pickStockFromPartners(row),
        active: pickBoolean(row, ["ativo", "active", "situacao"], true),
        photoUrl: pickPhotoUrl(row) || null,
      };
    })
    .filter(Boolean) as OlistProductInput[];
}

function parseTinySearchResults(payload: unknown) {
  const root = asRecord(payload);
  const retorno = root ? asRecord(root.retorno) : null;
  const products = retorno?.produtos;

  if (!Array.isArray(products)) return [];

  return products
    .map(asRecord)
    .filter(isRecord)
    .map((row) => asRecord(row.produto))
    .filter(isRecord)
    .map((product): TinySearchRow | null => {
      const id = pickString(product, ["id"]);
      const externalSku = pickString(product, ["codigo", "sku", "product_code"]);
      const name = pickString(product, ["nome", "name"]);
      if (!id || !externalSku || !name) return null;
      return { id, externalSku, name };
    })
    .filter(Boolean) as TinySearchRow[];
}

function parseTinyProductDetail(payload: unknown, fallback: TinySearchRow) {
  const root = asRecord(payload);
  const retorno = root ? asRecord(root.retorno) : null;
  const product = retorno?.produto ? asRecord(retorno.produto) : null;

  if (!product) {
    return {
      externalSku: fallback.externalSku,
      name: fallback.name,
      description: null,
      price: 0,
      stock: 0,
      active: true,
      photoUrl: null,
    } satisfies OlistProductInput;
  }

  return {
    externalSku:
      pickString(product, ["codigo", "sku", "product_code"]) || fallback.externalSku,
    name: pickString(product, ["nome", "name"]) || fallback.name,
    description:
      pickString(product, ["descricao", "descricao_complementar", "description"]) || null,
    price: pickNumber(product, ["preco", "preco_venda", "precoVenda", "valor"]),
    stock: Math.max(0, Math.trunc(pickNumber(product, ["saldo", "estoqueAtual", "estoque"]))),
    active: pickBoolean(product, ["situacao", "ativo"], true),
    photoUrl: pickPhotoUrl(product) || null,
  } satisfies OlistProductInput;
}

function parseTinyStock(payload: unknown) {
  const root = asRecord(payload);
  const retorno = root ? asRecord(root.retorno) : null;
  const product = retorno?.produto ? asRecord(retorno.produto) : null;

  if (product) {
    const direct = pickNumber(product, ["saldo", "estoque", "quantidade"]);
    if (direct > 0) return Math.max(0, Math.trunc(direct));

    const deposits = product.depositos;
    if (Array.isArray(deposits)) {
      const total = deposits
        .map(asRecord)
        .filter(isRecord)
        .map((row) => asRecord(row.deposito))
        .filter(isRecord)
        .reduce((sum, row) => sum + pickNumber(row, ["saldo", "quantidade"]), 0);
      return Math.max(0, Math.trunc(total));
    }
  }

  return 0;
}

async function postTinyForm<T>(url: string, params: URLSearchParams) {
  const res = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: params.toString(),
  });

  const text = await res.text().catch(() => "");
  let payload: T | null = null;
  if (text) {
    try {
      payload = JSON.parse(text) as T;
    } catch {
      payload = null;
    }
  }

  if (!res.ok) {
    const snippet = text.trim().replace(/\s+/g, " ").slice(0, 220);
    throw new Error(`Falha ao consultar Tiny (${res.status})${snippet ? `: ${snippet}` : "."}`);
  }

  const tinyError = parseTinyError(payload);
  if (tinyError) {
    throw new Error(tinyError);
  }

  return payload;
}

async function fetchTinySearchPageWithQuery(
  config: OlistConfig,
  page: number,
  query: string,
) {
  const params = new URLSearchParams();
  params.set("token", config.token);
  params.set("formato", "JSON");
  params.set("pagina", String(page));
  params.set("pesquisa", query);

  const payload = await postTinyForm<unknown>(config.productsUrl, params);
  return parseTinySearchResults(payload);
}

async function fetchTinySearchPayload(
  config: OlistConfig,
  page: number,
  query: string,
) {
  const params = new URLSearchParams();
  params.set("token", config.token);
  params.set("formato", "JSON");
  params.set("pagina", String(page));
  params.set("pesquisa", query);
  return postTinyForm<unknown>(config.productsUrl, params);
}

async function fetchTinyProductDetailWithOptions(
  config: OlistConfig,
  row: TinySearchRow,
  options?: FetchOlistProductsOptions,
) {
  const detailParams = new URLSearchParams();
  detailParams.set("token", config.token);
  detailParams.set("formato", "JSON");
  detailParams.set("id", row.id);

  const detailPayload = await postTinyForm<unknown>(config.productDetailsUrl, detailParams);
  const detail = parseTinyProductDetail(detailPayload, row);

  if ((config.useStockEndpoint || options?.forceStockEndpoint) && config.productStockUrl) {
    const stockParams = new URLSearchParams();
    stockParams.set("token", config.token);
    stockParams.set("formato", "JSON");
    stockParams.set("id", row.id);

    const stockPayload = await postTinyForm<unknown>(config.productStockUrl, stockParams);
    detail.stock = parseTinyStock(stockPayload);
  }

  return detail;
}

async function fetchTinyProducts(
  config: OlistConfig,
  options?: FetchOlistProductsOptions,
): Promise<FetchOlistProductsResult> {
  const page = Math.max(1, options?.page ?? 1);
  const offset = Math.max(0, options?.offset ?? 0);
  const batchSize = Math.min(20, Math.max(1, options?.batchSize ?? 10));
  const query = String(options?.query ?? config.productsQuery ?? "").trim();
  const rows = await fetchTinySearchPageWithQuery(config, page, query);
  const normalizedQuery = normalizeTinyLookup(query);
  const exactRows = query
    ? rows.filter((row) => {
        const externalSku = normalizeTinyLookup(row.externalSku);
        const id = normalizeTinyLookup(row.id);
        return externalSku === normalizedQuery || id === normalizedQuery;
      })
    : [];
  const rowsForSelection = exactRows.length > 0 ? exactRows : rows;
  const selectedRows = rowsForSelection.slice(offset, offset + batchSize);

  const detailed: OlistProductInput[] = [];
  for (const row of selectedRows) {
    detailed.push(await fetchTinyProductDetailWithOptions(config, row, options));
  }

  const moreInCurrentPage = offset + batchSize < rowsForSelection.length;
  const nextPage = moreInCurrentPage ? page : page + 1;
  const nextOffset = moreInCurrentPage ? offset + batchSize : 0;

  return {
    items: detailed,
    page,
    offset,
    nextPage,
    nextOffset,
    batchSize,
    hasMore: moreInCurrentPage || rowsForSelection.length > 0,
    mode: "tiny",
  };
}

async function fetchPartnersProducts(
  config: OlistConfig,
  options?: FetchOlistProductsOptions,
): Promise<FetchOlistProductsResult> {
  const page = Math.max(1, options?.page ?? 1);
  const offset = Math.max(0, options?.offset ?? 0);
  const batchSize = Math.min(50, Math.max(1, options?.batchSize ?? 20));
  const res = await fetch(config.productsUrl, {
    method: "GET",
    cache: "no-store",
    headers: {
      Authorization: `JWT ${config.idToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const snippet = body.trim().replace(/\s+/g, " ").slice(0, 220);
    throw new Error(
      `Falha ao consultar Olist (${res.status})${snippet ? `: ${snippet}` : "."}`,
    );
  }

  const items = parsePartnersProducts(await res.json().catch(() => null));
  const slice = items.slice(offset, offset + batchSize);
  const moreInCurrentPage = offset + batchSize < items.length;
  const nextPage = moreInCurrentPage ? page : page + 1;
  const nextOffset = moreInCurrentPage ? offset + batchSize : 0;

  return {
    items: slice,
    page,
    offset,
    nextPage,
    nextOffset,
    batchSize,
    hasMore: moreInCurrentPage,
    mode: "partners",
  };
}

export async function fetchOlistProducts(
  options?: FetchOlistProductsOptions,
): Promise<FetchOlistProductsResult> {
  const config = getOlistConfig();

  if (config.mode === "tiny") {
    if (!config.token || !config.productsUrl || !config.productDetailsUrl) {
      throw new Error(
        "OLIST_TOKEN, OLIST_PRODUCTS_URL e OLIST_PRODUCT_DETAILS_URL precisam estar configurados para o Tiny ERP.",
      );
    }

    return fetchTinyProducts(config, options);
  }

  if (!config.idToken || !config.productsUrl) {
    throw new Error(
      "OLIST_ID_TOKEN e OLIST_PRODUCTS_URL precisam estar configurados para a Partners API.",
    );
  }

  return fetchPartnersProducts(config, options);
}

export async function fetchTinyDebug(query: string): Promise<TinyDebugResult> {
  const config = getOlistConfig();
  const normalizedQuery = normalizeTinyLookup(query);

  if (config.mode !== "tiny" || !config.token || !config.productsUrl || !config.productDetailsUrl) {
    throw new Error("Diagnostico disponivel apenas para a integracao Tiny configurada.");
  }

  const rawSearch = await fetchTinySearchPayload(config, 1, query);
  const rows = parseTinySearchResults(rawSearch);
  const selectedRow =
    rows.find((row) => {
      const externalSku = normalizeTinyLookup(row.externalSku);
      const id = normalizeTinyLookup(row.id);
      return externalSku === normalizedQuery || id === normalizedQuery;
    }) ?? rows[0] ?? null;

  if (!selectedRow) {
    return {
      query,
      matched: false,
      selectedRow: null,
      parsedDetail: null,
      parsedStock: null,
      rawSearch,
      rawDetail: null,
      rawStock: null,
    };
  }

  const detailParams = new URLSearchParams();
  detailParams.set("token", config.token);
  detailParams.set("formato", "JSON");
  detailParams.set("id", selectedRow.id);
  const rawDetail = await postTinyForm<unknown>(config.productDetailsUrl, detailParams);
  const parsedDetail = parseTinyProductDetail(rawDetail, selectedRow);

  let rawStock: unknown = null;
  let parsedStock: number | null = null;

  if (config.productStockUrl) {
    const stockParams = new URLSearchParams();
    stockParams.set("token", config.token);
    stockParams.set("formato", "JSON");
    stockParams.set("id", selectedRow.id);
    rawStock = await postTinyForm<unknown>(config.productStockUrl, stockParams);
    parsedStock = parseTinyStock(rawStock);
  }

  return {
    query,
    matched: true,
    selectedRow,
    parsedDetail,
    parsedStock,
    rawSearch,
    rawDetail,
    rawStock,
  };
}
