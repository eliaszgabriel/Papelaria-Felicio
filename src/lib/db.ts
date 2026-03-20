import fs from "fs";
import { createRequire } from "module";
import path from "path";
import { runMigrations } from "./migrations";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3") as typeof import("better-sqlite3");

const DB_PATH =
  process.env.DB_PATH || path.join(process.cwd(), "data", "papelaria.sqlite");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
runMigrations();

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    createdAt INTEGER NOT NULL,
    status TEXT NOT NULL,
    paymentMethod TEXT NOT NULL,
    paymentJson TEXT,
    customerJson TEXT NOT NULL,
    addressJson TEXT,
    itemsJson TEXT NOT NULL,
    subtotal REAL NOT NULL,
    shippingAmount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL,
    statusHistoryJson TEXT
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    shortDescription TEXT,
    colorOptionsJson TEXT,
    description TEXT,
    price REAL NOT NULL,
    compareAtPrice REAL,
    stock INTEGER NOT NULL DEFAULT 0,
    sku TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    subCategoryId TEXT,
    color TEXT,
    inMovingShowcase INTEGER NOT NULL DEFAULT 0,
    isCollection INTEGER NOT NULL DEFAULT 0,
    isWeeklyFavorite INTEGER NOT NULL DEFAULT 0,
    externalSource TEXT,
    externalSku TEXT,
    syncStock INTEGER NOT NULL DEFAULT 0,
    syncPrice INTEGER NOT NULL DEFAULT 0,
    lastSyncedAt INTEGER,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS external_product_blocks (
    source TEXT NOT NULL,
    externalSku TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    PRIMARY KEY (source, externalSku)
  );

  CREATE TABLE IF NOT EXISTS integration_cursors (
    id TEXT PRIMARY KEY,
    page INTEGER NOT NULL DEFAULT 1,
    offset INTEGER NOT NULL DEFAULT 0,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS product_images (
    id TEXT PRIMARY KEY,
    productId TEXT NOT NULL,
    url TEXT NOT NULL,
    alt TEXT,
    sortOrder INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
  CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
  CREATE INDEX IF NOT EXISTS idx_product_images_productId ON product_images(productId);
  CREATE INDEX IF NOT EXISTS idx_orders_createdAt ON orders(createdAt DESC);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
`);

try {
  db.exec(`ALTER TABLE orders ADD COLUMN statusHistoryJson TEXT`);
} catch {}

try {
  db.exec(`ALTER TABLE orders ADD COLUMN shippingAmount REAL NOT NULL DEFAULT 0`);
} catch {}

try {
  db.exec(`ALTER TABLE products ADD COLUMN shortDescription TEXT`);
} catch {}

try {
  db.exec(`ALTER TABLE products ADD COLUMN colorOptionsJson TEXT`);
} catch {}

try {
  db.exec(`ALTER TABLE products ADD COLUMN isCollection INTEGER NOT NULL DEFAULT 0`);
} catch {}

try {
  db.exec(`ALTER TABLE products ADD COLUMN isWeeklyFavorite INTEGER NOT NULL DEFAULT 0`);
} catch {}

try {
  db.exec(`ALTER TABLE products ADD COLUMN subCategoryId TEXT`);
} catch {}

try {
  db.exec(`ALTER TABLE products ADD COLUMN color TEXT`);
} catch {}

try {
  db.exec(`ALTER TABLE products ADD COLUMN inMovingShowcase INTEGER NOT NULL DEFAULT 0`);
} catch {}

try {
  db.exec(`ALTER TABLE products ADD COLUMN externalSource TEXT`);
} catch {}

try {
  db.exec(`ALTER TABLE products ADD COLUMN externalSku TEXT`);
} catch {}

try {
  db.exec(`ALTER TABLE products ADD COLUMN syncStock INTEGER NOT NULL DEFAULT 0`);
} catch {}

try {
  db.exec(`ALTER TABLE products ADD COLUMN syncPrice INTEGER NOT NULL DEFAULT 0`);
} catch {}

try {
  db.exec(`ALTER TABLE products ADD COLUMN lastSyncedAt INTEGER`);
} catch {}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS external_product_blocks (
      source TEXT NOT NULL,
      externalSku TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      PRIMARY KEY (source, externalSku)
    )
  `);
} catch {}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS integration_cursors (
      id TEXT PRIMARY KEY,
      page INTEGER NOT NULL DEFAULT 1,
      offset INTEGER NOT NULL DEFAULT 0,
      updatedAt INTEGER NOT NULL
    )
  `);
} catch {}
