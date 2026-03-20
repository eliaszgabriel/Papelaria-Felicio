import { db } from "./db";
import { DEFAULT_CATEGORIES } from "./catalog";

function addColumn(sql: string) {
  try {
    db.exec(sql);
  } catch {
    // Coluna já existe.
  }
}

export function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name          TEXT,
      phone         TEXT,
      cpf           TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  addColumn(`ALTER TABLE users ADD COLUMN cpf TEXT`);
  addColumn(`ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0`);
  addColumn(`ALTER TABLE users ADD COLUMN email_verified_at TEXT`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_addresses (
      id            TEXT    PRIMARY KEY,
      user_id       INTEGER NOT NULL,
      label         TEXT,
      recipientName TEXT,
      phone         TEXT,
      zip           TEXT    NOT NULL,
      street        TEXT    NOT NULL,
      number        TEXT    NOT NULL,
      complement    TEXT,
      district      TEXT,
      city          TEXT    NOT NULL,
      uf            TEXT    NOT NULL,
      isDefault     INTEGER NOT NULL DEFAULT 0,
      createdAt     INTEGER NOT NULL,
      updatedAt     INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_customer_addresses_user_id ON customer_addresses(user_id);
    CREATE INDEX IF NOT EXISTS idx_customer_addresses_default ON customer_addresses(user_id, isDefault);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS wishlist_items (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      product_id TEXT    NOT NULL,
      createdAt  INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
      UNIQUE(user_id, product_id),
      FOREIGN KEY(user_id)    REFERENCES users(id)    ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_wishlist_user_id ON wishlist_items(user_id);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id               TEXT    PRIMARY KEY,
      slug             TEXT    NOT NULL UNIQUE,
      name             TEXT    NOT NULL,
      shortDescription TEXT,
      description      TEXT,
      price            REAL    NOT NULL,
      compareAtPrice   REAL,
      stock            INTEGER NOT NULL DEFAULT 0,
      sku              TEXT,
      active           INTEGER NOT NULL DEFAULT 1,
      categoryId       TEXT,
      subCategoryId    TEXT,
      color            TEXT,
      inMovingShowcase INTEGER NOT NULL DEFAULT 0,
      featured         INTEGER NOT NULL DEFAULT 0,
      deal             INTEGER NOT NULL DEFAULT 0,
      isCollection     INTEGER NOT NULL DEFAULT 0,
      isWeeklyFavorite INTEGER NOT NULL DEFAULT 0,
      externalSource   TEXT,
      externalSku      TEXT,
      syncStock        INTEGER NOT NULL DEFAULT 0,
      syncPrice        INTEGER NOT NULL DEFAULT 0,
      lastSyncedAt     INTEGER,
      createdAt        INTEGER NOT NULL,
      updatedAt        INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS external_product_blocks (
      source      TEXT NOT NULL,
      externalSku TEXT NOT NULL,
      createdAt   INTEGER NOT NULL,
      PRIMARY KEY (source, externalSku)
    );
    CREATE TABLE IF NOT EXISTS integration_cursors (
      id        TEXT PRIMARY KEY,
      page      INTEGER NOT NULL DEFAULT 1,
      offset    INTEGER NOT NULL DEFAULT 0,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS product_images (
      id        TEXT    PRIMARY KEY,
      productId TEXT    NOT NULL,
      url       TEXT    NOT NULL,
      alt       TEXT,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS categories (
      id        TEXT    PRIMARY KEY,
      name      TEXT    NOT NULL,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      active    INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS product_category_links (
      productId  TEXT NOT NULL,
      categoryId TEXT NOT NULL,
      createdAt  INTEGER NOT NULL,
      PRIMARY KEY (productId, categoryId),
      FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY(categoryId) REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
    CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
    CREATE INDEX IF NOT EXISTS idx_products_categoryId ON products(categoryId);
    CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured);
    CREATE INDEX IF NOT EXISTS idx_products_deal ON products(deal);
    CREATE INDEX IF NOT EXISTS idx_product_images_pid ON product_images(productId);
    CREATE INDEX IF NOT EXISTS idx_product_category_links_categoryId ON product_category_links(categoryId);
  `);

  addColumn(`ALTER TABLE products ADD COLUMN categoryId TEXT`);
  addColumn(`ALTER TABLE products ADD COLUMN shortDescription TEXT`);
  addColumn(`ALTER TABLE products ADD COLUMN subCategoryId TEXT`);
  addColumn(`ALTER TABLE products ADD COLUMN color TEXT`);
  addColumn(`ALTER TABLE products ADD COLUMN inMovingShowcase INTEGER NOT NULL DEFAULT 0`);
  addColumn(`ALTER TABLE products ADD COLUMN featured INTEGER NOT NULL DEFAULT 0`);
  addColumn(`ALTER TABLE products ADD COLUMN deal INTEGER NOT NULL DEFAULT 0`);
  addColumn(`ALTER TABLE products ADD COLUMN isCollection INTEGER NOT NULL DEFAULT 0`);
  addColumn(`ALTER TABLE products ADD COLUMN isWeeklyFavorite INTEGER NOT NULL DEFAULT 0`);
  addColumn(`ALTER TABLE products ADD COLUMN externalSource TEXT`);
  addColumn(`ALTER TABLE products ADD COLUMN externalSku TEXT`);
  addColumn(`ALTER TABLE products ADD COLUMN syncStock INTEGER NOT NULL DEFAULT 0`);
  addColumn(`ALTER TABLE products ADD COLUMN syncPrice INTEGER NOT NULL DEFAULT 0`);
  addColumn(`ALTER TABLE products ADD COLUMN lastSyncedAt INTEGER`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id                TEXT    PRIMARY KEY,
      createdAt         INTEGER NOT NULL,
      status            TEXT    NOT NULL,
      paymentMethod     TEXT    NOT NULL,
      paymentJson       TEXT,
      customerJson      TEXT    NOT NULL,
      customerEmail     TEXT,
      addressJson       TEXT,
      itemsJson         TEXT    NOT NULL,
      subtotal          REAL    NOT NULL,
      shippingAmount    REAL    NOT NULL DEFAULT 0,
      total             REAL    NOT NULL,
      statusHistoryJson TEXT,
      user_id           INTEGER,
      trackingCode      TEXT,
      trackingCarrier   TEXT,
      trackingUrl       TEXT,
      paidNotifiedAt    INTEGER,
      shippedNotifiedAt INTEGER,
      stockDeductedAt   INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_orders_createdAt ON orders(createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_customerEmail ON orders(customerEmail);
    CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS request_rate_limits (
      key       TEXT PRIMARY KEY,
      count     INTEGER NOT NULL DEFAULT 0,
      resetAt   INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_request_rate_limits_resetAt ON request_rate_limits(resetAt);
  `);

  addColumn(`ALTER TABLE orders ADD COLUMN customerEmail TEXT`);
  addColumn(`ALTER TABLE orders ADD COLUMN user_id INTEGER`);
  addColumn(`ALTER TABLE orders ADD COLUMN trackingCode TEXT`);
  addColumn(`ALTER TABLE orders ADD COLUMN trackingCarrier TEXT`);
  addColumn(`ALTER TABLE orders ADD COLUMN trackingUrl TEXT`);
  addColumn(`ALTER TABLE orders ADD COLUMN paidNotifiedAt INTEGER`);
  addColumn(`ALTER TABLE orders ADD COLUMN shippedNotifiedAt INTEGER`);
  addColumn(`ALTER TABLE orders ADD COLUMN statusHistoryJson TEXT`);
  addColumn(`ALTER TABLE orders ADD COLUMN stockDeductedAt INTEGER`);
  addColumn(`ALTER TABLE orders ADD COLUMN shippingAmount REAL NOT NULL DEFAULT 0`);

  try {
    db.exec(`
      UPDATE orders
      SET customerEmail = lower(json_extract(customerJson, '$.email'))
      WHERE (customerEmail IS NULL OR customerEmail = '')
        AND customerJson IS NOT NULL
        AND customerJson <> '';
    `);
  } catch {
    // noop
  }

  try {
    const now = Date.now();
    const insertCategory = db.prepare(`
      INSERT OR IGNORE INTO categories (id, name, sortOrder, active, createdAt, updatedAt)
      VALUES (?, ?, ?, 1, ?, ?)
    `);
    const updateCategory = db.prepare(`
      UPDATE categories
      SET name = ?, sortOrder = ?, active = 1, updatedAt = ?
      WHERE id = ?
    `);

    for (const category of DEFAULT_CATEGORIES) {
      insertCategory.run(
        category.id,
        category.name,
        category.sortOrder,
        now,
        now,
      );
      updateCategory.run(
        category.name,
        category.sortOrder,
        now,
        category.id,
      );
    }

    db.exec(`
      UPDATE categories
      SET active = 0, updatedAt = ${now}
      WHERE id IN ('papelaria', 'escrita', 'organizacao', 'marcas', 'diversos', 'outlet');
    `);

    db.exec(`
      UPDATE products
      SET categoryId = CASE categoryId
        WHEN 'papelaria' THEN 'cadernos'
        WHEN 'escrita' THEN 'canetas'
        WHEN 'organizacao' THEN 'agendas-planners'
        WHEN 'diversos' THEN 'fofuras'
        WHEN 'outlet' THEN 'papeis'
        ELSE categoryId
      END
      WHERE categoryId IN ('papelaria', 'escrita', 'organizacao', 'diversos', 'outlet');
    `);

    db.exec(`
      INSERT OR IGNORE INTO product_category_links (productId, categoryId, createdAt)
      SELECT id, categoryId, ${now}
      FROM products
      WHERE categoryId IS NOT NULL
        AND categoryId <> '';
    `);
  } catch {
    // noop
  }
}
