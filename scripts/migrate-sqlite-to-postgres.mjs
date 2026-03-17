import fs from "fs";
import path from "path";
import pg from "pg";
import initSqlJs from "sql.js";

const { Client } = pg;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

const SQLITE_PATH =
  process.env.DB_PATH || path.join(process.cwd(), "data", "papelaria.sqlite");
const POSTGRES_URL = process.env.POSTGRES_URL || "";
const POSTGRES_SSL = process.env.POSTGRES_SSL || "";
const schemaPath = path.join(process.cwd(), "scripts", "postgres", "schema.sql");

if (!POSTGRES_URL) {
  throw new Error("POSTGRES_URL nao configurado");
}

if (!fs.existsSync(SQLITE_PATH)) {
  throw new Error(`SQLite nao encontrado em ${SQLITE_PATH}`);
}

const client = new Client({
  connectionString: (() => {
    const url = new URL(POSTGRES_URL);
    url.searchParams.delete("sslmode");
    url.searchParams.delete("ssl");
    return url.toString();
  })(),
  ssl: POSTGRES_SSL === "require" ? { rejectUnauthorized: false } : undefined,
});

function toJson(value) {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value : JSON.stringify(value);
}

async function insertRows({
  table,
  columns,
  conflict,
  rows,
}) {
  if (!rows.length) return;

  const colList = columns.join(", ");
  const updateCols = columns.filter((column) => !conflict.includes(column));
  const updateSql = updateCols.length
    ? updateCols.map((column) => `${column} = EXCLUDED.${column}`).join(", ")
    : "";
  const batchSize = 200;

  console.log(`[migracao] ${table}: ${rows.length} registro(s)`);

  for (let start = 0; start < rows.length; start += batchSize) {
    const chunk = rows.slice(start, start + batchSize);
    const values = [];
    const valueGroups = chunk.map((row, rowIndex) => {
      const placeholders = columns.map((column, columnIndex) => {
        values.push(row[column] ?? null);
        return `$${rowIndex * columns.length + columnIndex + 1}`;
      });
      return `(${placeholders.join(", ")})`;
    });

    const query = `
      INSERT INTO ${table} (${colList})
      VALUES ${valueGroups.join(", ")}
      ON CONFLICT (${conflict.join(", ")})
      ${updateSql ? `DO UPDATE SET ${updateSql}` : "DO NOTHING"}
    `;

    await client.query(query, values);
    console.log(
      `[migracao] ${table}: ${Math.min(start + chunk.length, rows.length)}/${rows.length}`,
    );
  }
}

function sqliteRows(database, query) {
  const result = database.exec(query);
  if (!result.length) return [];

  const [{ columns, values }] = result;
  return values.map((row) =>
    Object.fromEntries(columns.map((column, index) => [column, row[index]])),
  );
}

async function main() {
  const SQL = await initSqlJs();
  const sqliteBuffer = fs.readFileSync(SQLITE_PATH);
  const sqlite = new SQL.Database(sqliteBuffer);

  await client.connect();
  console.log("[migracao] conectado ao Postgres");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");

  await client.query("BEGIN");
  try {
    console.log("[migracao] criando schema");
    await client.query(schemaSql);

    const users = sqliteRows(sqlite, "SELECT * FROM users");
    await insertRows({
      table: "users",
      columns: [
        "id",
        "email",
        "password_hash",
        "name",
        "phone",
        "cpf",
        "created_at",
        "updated_at",
        "email_verified",
        "email_verified_at",
      ],
      conflict: ["id"],
      rows: users.map((row) => ({
        ...row,
        email_verified: Number(row.email_verified ?? 0),
      })),
    });

    const customerAddresses = sqliteRows(
      sqlite,
      "SELECT * FROM customer_addresses",
    );
    await insertRows({
      table: "customer_addresses",
      columns: [
        "id",
        "user_id",
        "label",
        "recipientName",
        "phone",
        "zip",
        "street",
        "number",
        "complement",
        "district",
        "city",
        "uf",
        "isDefault",
        "createdAt",
        "updatedAt",
      ],
      conflict: ["id"],
      rows: customerAddresses,
    });

    const categories = sqliteRows(sqlite, "SELECT * FROM categories");
    await insertRows({
      table: "categories",
      columns: ["id", "name", "sortOrder", "active", "createdAt", "updatedAt"],
      conflict: ["id"],
      rows: categories,
    });

    const products = sqliteRows(sqlite, "SELECT * FROM products");
    await insertRows({
      table: "products",
      columns: [
        "id",
        "slug",
        "name",
        "description",
        "price",
        "compareAtPrice",
        "stock",
        "sku",
        "active",
        "categoryId",
        "subCategoryId",
        "color",
        "inMovingShowcase",
        "featured",
        "deal",
        "isCollection",
        "isWeeklyFavorite",
        "externalSource",
        "externalSku",
        "syncStock",
        "syncPrice",
        "lastSyncedAt",
        "createdAt",
        "updatedAt",
      ],
      conflict: ["id"],
      rows: products,
    });

    const productImages = sqliteRows(sqlite, "SELECT * FROM product_images");
    await insertRows({
      table: "product_images",
      columns: ["id", "productId", "url", "alt", "sortOrder"],
      conflict: ["id"],
      rows: productImages,
    });

    const productCategoryLinks = sqliteRows(
      sqlite,
      "SELECT * FROM product_category_links",
    );
    await insertRows({
      table: "product_category_links",
      columns: ["productId", "categoryId", "createdAt"],
      conflict: ["productId", "categoryId"],
      rows: productCategoryLinks,
    });

    const wishlistItems = sqliteRows(sqlite, "SELECT * FROM wishlist_items");
    await insertRows({
      table: "wishlist_items",
      columns: ["id", "user_id", "product_id", "createdAt"],
      conflict: ["id"],
      rows: wishlistItems,
    });

    const externalBlocks = sqliteRows(
      sqlite,
      "SELECT * FROM external_product_blocks",
    );
    await insertRows({
      table: "external_product_blocks",
      columns: ["source", "externalSku", "createdAt"],
      conflict: ["source", "externalSku"],
      rows: externalBlocks,
    });

    const integrationCursors = sqliteRows(
      sqlite,
      "SELECT * FROM integration_cursors",
    );
    await insertRows({
      table: "integration_cursors",
      columns: ["id", "page", '"offset"', "updatedAt"],
      conflict: ["id"],
      rows: integrationCursors.map((row) => ({
        id: row.id,
        page: row.page,
        '"offset"': row.offset,
        updatedAt: row.updatedAt,
      })),
    });

    const orders = sqliteRows(sqlite, "SELECT * FROM orders");
    await insertRows({
      table: "orders",
      columns: [
        "id",
        "createdAt",
        "status",
        "paymentMethod",
        "paymentJson",
        "customerJson",
        "customerEmail",
        "addressJson",
        "itemsJson",
        "subtotal",
        "shippingAmount",
        "total",
        "statusHistoryJson",
        "user_id",
        "trackingCode",
        "trackingCarrier",
        "trackingUrl",
        "paidNotifiedAt",
        "shippedNotifiedAt",
        "stockDeductedAt",
      ],
      conflict: ["id"],
      rows: orders.map((row) => ({
        ...row,
        paymentJson: toJson(row.paymentJson),
        customerJson: toJson(row.customerJson),
        addressJson: toJson(row.addressJson),
        itemsJson: toJson(row.itemsJson),
        statusHistoryJson: toJson(row.statusHistoryJson),
      })),
    });

    const requestRateLimits = sqliteRows(
      sqlite,
      "SELECT * FROM request_rate_limits",
    );
    await insertRows({
      table: "request_rate_limits",
      columns: ["key", "count", "resetAt", "updatedAt"],
      conflict: ["key"],
      rows: requestRateLimits,
    });

    await client.query(`
      SELECT setval(
        pg_get_serial_sequence('users', 'id'),
        COALESCE((SELECT MAX(id) FROM users), 1),
        true
      )
    `);

    await client.query(`
      SELECT setval(
        pg_get_serial_sequence('wishlist_items', 'id'),
        COALESCE((SELECT MAX(id) FROM wishlist_items), 1),
        true
      )
    `);

    console.log("[migracao] ajustando sequences");
    await client.query("COMMIT");
    console.log("Migracao SQLite -> Postgres concluida com sucesso.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    sqlite.close();
    await client.end();
  }
}

main().catch((error) => {
  console.error("Falha na migracao:", error);
  process.exit(1);
});
