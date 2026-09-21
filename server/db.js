import pg from "pg";
import { nanoid } from "nanoid";
import seedCatalog from "./catalog.json" with { type: "json" };

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || "") ? false : { rejectUnauthorized: false },
});

const DEFAULT_CATEGORIES = [
  { name: "Ish haqi", type: "income", color: "#2f6f4f" },
  { name: "Sotuvdan tushum", type: "income", color: "#3b7a57" },
  { name: "Boshqa daromad", type: "income", color: "#6ba888" },
  { name: "Tovar xaridi", type: "expense", color: "#a5473c" },
  { name: "Transport", type: "expense", color: "#b5793c" },
  { name: "Boshqa xarajat", type: "expense", color: "#6b6b6b" },
];

let schemaReady = null;
function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          created_at BIGINT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('income','expense')),
          color TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL CHECK (type IN ('income','expense')),
          amount NUMERIC NOT NULL,
          category TEXT NOT NULL,
          note TEXT DEFAULT '',
          date TIMESTAMPTZ NOT NULL,
          created_at BIGINT NOT NULL,
          inventory_id TEXT
        );
        CREATE TABLE IF NOT EXISTS budgets (
          category_id TEXT PRIMARY KEY,
          limit_amount NUMERIC NOT NULL
        );
        CREATE TABLE IF NOT EXISTS goal (
          id INT PRIMARY KEY DEFAULT 1,
          name TEXT,
          target_amount NUMERIC
        );
        CREATE TABLE IF NOT EXISTS inventory (
          id TEXT PRIMARY KEY,
          product_id INT,
          title TEXT NOT NULL,
          image TEXT,
          category TEXT,
          quantity NUMERIC NOT NULL DEFAULT 1,
          purchase_price NUMERIC NOT NULL,
          purchased_at TIMESTAMPTZ NOT NULL,
          status TEXT NOT NULL DEFAULT 'holding' CHECK (status IN ('holding','sold')),
          sold_price NUMERIC,
          sold_at TIMESTAMPTZ
        );
        -- Multi-user: every row belongs to a user. Pre-existing rows have NULL user_id
        -- and are claimed by the first account that registers.
        ALTER TABLE categories ADD COLUMN IF NOT EXISTS user_id TEXT;
        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id TEXT;
        ALTER TABLE budgets ADD COLUMN IF NOT EXISTS user_id TEXT;
        ALTER TABLE inventory ADD COLUMN IF NOT EXISTS user_id TEXT;
        CREATE TABLE IF NOT EXISTS goals (
          user_id TEXT PRIMARY KEY,
          name TEXT,
          target_amount NUMERIC
        );
        ALTER TABLE inventory ADD COLUMN IF NOT EXISTS order_id TEXT;
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
          total_usd NUMERIC NOT NULL,
          total_uzs BIGINT NOT NULL,
          rate NUMERIC NOT NULL,
          full_name TEXT,
          phone TEXT,
          address TEXT,
          provider TEXT,
          provider_ref TEXT,
          created_at BIGINT NOT NULL,
          paid_at BIGINT
        );
        CREATE TABLE IF NOT EXISTS order_items (
          id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL,
          product_id INT,
          title TEXT NOT NULL,
          image TEXT,
          category TEXT,
          quantity INT NOT NULL,
          unit_price_usd NUMERIC NOT NULL
        );
        CREATE TABLE IF NOT EXISTS payment_transactions (
          id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL,
          amount BIGINT NOT NULL,
          state INT NOT NULL,
          reason INT,
          create_time BIGINT NOT NULL,
          perform_time BIGINT NOT NULL DEFAULT 0,
          cancel_time BIGINT NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
        CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
        CREATE TABLE IF NOT EXISTS products (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          category TEXT NOT NULL,
          price_usd NUMERIC NOT NULL CHECK (price_usd > 0),
          image TEXT,
          rating_rate NUMERIC,
          rating_count INT,
          active BOOLEAN NOT NULL DEFAULT TRUE
        );
        ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_usd NUMERIC;
        -- Prices are in so'm (integer). The old USD columns stay for history but are no longer required.
        ALTER TABLE products ADD COLUMN IF NOT EXISTS price_uzs BIGINT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_uzs BIGINT;
        ALTER TABLE products ALTER COLUMN price_usd DROP NOT NULL;
        ALTER TABLE products DROP CONSTRAINT IF EXISTS products_price_usd_check;
        ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_price_uzs BIGINT;
        ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_cost_uzs BIGINT;
        UPDATE products SET price_uzs = ROUND(price_usd * 12500 / 1000) * 1000 WHERE price_uzs IS NULL AND price_usd IS NOT NULL;
        UPDATE products SET cost_uzs = ROUND(cost_usd * 12500 / 1000) * 1000 WHERE cost_uzs IS NULL AND cost_usd IS NOT NULL;
        UPDATE order_items i SET unit_price_uzs = ROUND(i.unit_price_usd * o.rate)
          FROM orders o WHERE o.id = i.order_id AND i.unit_price_uzs IS NULL;
        UPDATE order_items i SET unit_cost_uzs = ROUND(i.unit_cost_usd * o.rate)
          FROM orders o WHERE o.id = i.order_id AND i.unit_cost_uzs IS NULL AND i.unit_cost_usd IS NOT NULL;
        ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_cost_usd NUMERIC;
        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS order_id TEXT;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_order_type ON transactions(user_id, order_id, type) WHERE order_id IS NOT NULL;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment TEXT NOT NULL DEFAULT 'new';
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_at BIGINT;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_note TEXT;
        CREATE TABLE IF NOT EXISTS click_transactions (
          click_trans_id TEXT PRIMARY KEY,
          prepare_id TEXT NOT NULL UNIQUE,
          order_id TEXT NOT NULL,
          amount NUMERIC NOT NULL,
          state TEXT NOT NULL,
          created_at BIGINT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS product_images (
          product_id INT PRIMARY KEY,
          mime TEXT NOT NULL,
          data BYTEA NOT NULL,
          updated_at BIGINT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS promos (
          code TEXT PRIMARY KEY,
          kind TEXT NOT NULL CHECK (kind IN ('percent','amount')),
          value BIGINT NOT NULL,
          min_total BIGINT NOT NULL DEFAULT 0,
          max_uses INT,
          used INT NOT NULL DEFAULT 0,
          expires_at BIGINT,
          active BOOLEAN NOT NULL DEFAULT TRUE
        );
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code TEXT;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_uzs BIGINT NOT NULL DEFAULT 0;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_uzs BIGINT NOT NULL DEFAULT 0;
        CREATE TABLE IF NOT EXISTS reviews (
          id TEXT PRIMARY KEY,
          product_id INT NOT NULL,
          user_id TEXT NOT NULL,
          rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
          comment TEXT,
          created_at BIGINT NOT NULL,
          UNIQUE (user_id, product_id)
        );
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS password_resets (
          token_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          expires_at BIGINT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS auth_attempts (
          key TEXT PRIMARY KEY,
          count INT NOT NULL,
          reset_at BIGINT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_click_order ON click_transactions(order_id);
        CREATE INDEX IF NOT EXISTS idx_pay_order ON payment_transactions(order_id);
        CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id);
        CREATE INDEX IF NOT EXISTS idx_inv_user ON inventory(user_id);
        CREATE INDEX IF NOT EXISTS idx_cat_user ON categories(user_id);
      `);
      // First run: load the starter catalog (keeps ids stable, then moves the sequence past them).
      const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM products");
      if (rows[0].n === 0) {
        for (const p of seedCatalog) {
          await pool.query(
            `INSERT INTO products (id, title, description, category, price_uzs, image, rating_rate, rating_count)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
            [p.id, p.title, p.description, p.category, Math.round((p.priceUsd * 12500) / 1000) * 1000, p.image, p.ratingRate, p.ratingCount]
          );
        }
        await pool.query("SELECT setval(pg_get_serial_sequence('products','id'), (SELECT MAX(id) FROM products))");
      }
    })();
  }
  return schemaReady;
}

function mapProduct(r, admin = false) {
  return {
    ...(admin ? { cost: r.cost_uzs == null ? null : Number(r.cost_uzs) } : {}),
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    price: Number(r.price_uzs),
    image: r.image,
    rating: r.rating_rate == null ? null : { rate: Number(r.rating_rate), count: r.rating_count },
    stock: r.stock,
    active: r.active,
  };
}

function mapPromo(r) {
  return {
    code: r.code, kind: r.kind, value: Number(r.value), minTotal: Number(r.min_total),
    maxUses: r.max_uses, used: r.used, expiresAt: r.expires_at ? Number(r.expires_at) : null, active: r.active,
  };
}

function mapCategory(r) {
  return { id: r.id, name: r.name, type: r.type, color: r.color };
}

function mapTransaction(r) {
  return {
    id: r.id,
    type: r.type,
    amount: Number(r.amount),
    category: r.category,
    note: r.note || "",
    date: r.date.toISOString(),
    createdAt: Number(r.created_at),
    inventoryId: r.inventory_id || null,
  };
}

function mapInventory(r) {
  return {
    id: r.id,
    productId: r.product_id,
    title: r.title,
    image: r.image,
    category: r.category,
    quantity: Number(r.quantity),
    purchasePrice: Number(r.purchase_price),
    purchasedAt: r.purchased_at.toISOString(),
    status: r.status,
    soldPrice: r.sold_price !== null ? Number(r.sold_price) : null,
    soldAt: r.sold_at ? r.sold_at.toISOString() : null,
  };
}

function mapOrder(r, items) {
  return {
    id: r.id,
    status: r.status,
    totalUzs: Number(r.total_uzs),
    fullName: r.full_name,
    phone: r.phone,
    address: r.address,
    provider: r.provider,
    createdAt: Number(r.created_at),
    paidAt: r.paid_at ? Number(r.paid_at) : null,
    promoCode: r.promo_code || null,
    discountUzs: Number(r.discount_uzs || 0),
    deliveryUzs: Number(r.delivery_uzs || 0),
    customerId: r.user_id,
    fulfillment: r.fulfillment || "new",
    fulfillmentAt: r.fulfillment_at ? Number(r.fulfillment_at) : null,
    adminNote: r.admin_note || "",
    customerEmail: r.customer_email,
    items: (items || []).map((i) => ({
      productId: i.product_id,
      title: i.title,
      image: i.image,
      quantity: i.quantity,
      unitPriceUzs: Number(i.unit_price_uzs),
    })),
  };
}

function mapPayment(r) {
  return {
    id: r.id,
    orderId: r.order_id,
    amount: Number(r.amount),
    state: r.state,
    reason: r.reason,
    createTime: Number(r.create_time),
    performTime: Number(r.perform_time),
    cancelTime: Number(r.cancel_time),
  };
}

async function seedCategories(userId) {
  for (const c of DEFAULT_CATEGORIES) {
    await pool.query("INSERT INTO categories (id, name, type, color, user_id) VALUES ($1,$2,$3,$4,$5)", [
      nanoid(8),
      c.name,
      c.type,
      c.color,
      userId,
    ]);
  }
}

export const db = {
  // ---- Users ----
  async findUserByEmail(email) {
    await ensureSchema();
    const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    return rows[0] || null;
  },
  async findUserById(id) {
    await ensureSchema();
    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    return rows[0] || null;
  },
  // Creates the user. The very first user also adopts any legacy (user_id IS NULL) data;
  // otherwise the new user gets the default categories.
  async createUser(email, passwordHash) {
    await ensureSchema();
    const id = nanoid(12);
    const { rows: countRows } = await pool.query("SELECT COUNT(*)::int AS n FROM users");
    const isFirst = countRows[0].n === 0;
    await pool.query("INSERT INTO users (id, email, password_hash, created_at) VALUES ($1,$2,$3,$4)", [
      id,
      email,
      passwordHash,
      Date.now(),
    ]);
    let adopted = false;
    if (isFirst) {
      const { rowCount } = await pool.query("UPDATE categories SET user_id = $1 WHERE user_id IS NULL", [id]);
      adopted = rowCount > 0;
      await pool.query("UPDATE transactions SET user_id = $1 WHERE user_id IS NULL", [id]);
      await pool.query("UPDATE budgets SET user_id = $1 WHERE user_id IS NULL", [id]);
      await pool.query("UPDATE inventory SET user_id = $1 WHERE user_id IS NULL", [id]);
      await pool.query(
        `INSERT INTO goals (user_id, name, target_amount)
         SELECT $1, name, target_amount FROM goal WHERE id = 1 AND target_amount IS NOT NULL
         ON CONFLICT (user_id) DO NOTHING`,
        [id]
      );
    }
    if (!adopted) await seedCategories(id);
    return { id, email };
  },
  async deleteUserAndData(userId) {
    await ensureSchema();
    await pool.query("DELETE FROM budgets WHERE user_id = $1", [userId]);
    await pool.query("DELETE FROM transactions WHERE user_id = $1", [userId]);
    await pool.query("DELETE FROM inventory WHERE user_id = $1", [userId]);
    await pool.query("DELETE FROM categories WHERE user_id = $1", [userId]);
    await pool.query("DELETE FROM goals WHERE user_id = $1", [userId]);
    // Orders are the shop's sales records: keep them for accounting but strip the person's details.
    await pool.query(
      "UPDATE orders SET user_id = 'deleted', full_name = 'O''chirilgan hisob', phone = NULL, address = NULL WHERE user_id = $1",
      [userId]
    );
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
  },

  // ---- Transactions ----
  async listTransactions(userId) {
    await ensureSchema();
    const { rows } = await pool.query(
      "SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC, created_at DESC",
      [userId]
    );
    return rows.map(mapTransaction);
  },
  async addTransaction(userId, tx) {
    await ensureSchema();
    const id = nanoid(10);
    const { rows } = await pool.query(
      `INSERT INTO transactions (id, type, amount, category, note, date, created_at, inventory_id, user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, tx.type, Number(tx.amount), tx.category, tx.note || "", tx.date, Date.now(), tx.inventoryId || null, userId]
    );
    return mapTransaction(rows[0]);
  },
  async deleteTransaction(userId, id) {
    await ensureSchema();
    const { rowCount } = await pool.query("DELETE FROM transactions WHERE id = $1 AND user_id = $2", [id, userId]);
    return rowCount > 0;
  },

  // ---- Categories ----
  async listCategories(userId) {
    await ensureSchema();
    const { rows } = await pool.query("SELECT * FROM categories WHERE user_id = $1 ORDER BY type, name", [userId]);
    return rows.map(mapCategory);
  },
  async addCategory(userId, cat) {
    await ensureSchema();
    const id = nanoid(8);
    const { rows } = await pool.query(
      "INSERT INTO categories (id, name, type, color, user_id) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [id, cat.name, cat.type, cat.color || "#777777", userId]
    );
    return mapCategory(rows[0]);
  },
  async deleteCategory(userId, id) {
    await ensureSchema();
    const { rowCount } = await pool.query("DELETE FROM categories WHERE id = $1 AND user_id = $2", [id, userId]);
    return rowCount > 0;
  },

  // ---- Budgets ----
  async getBudgets(userId) {
    await ensureSchema();
    const { rows } = await pool.query("SELECT * FROM budgets WHERE user_id = $1", [userId]);
    return Object.fromEntries(rows.map((r) => [r.category_id, Number(r.limit_amount)]));
  },
  async setBudget(userId, categoryId, limit) {
    await ensureSchema();
    if (limit === null || limit === undefined || limit === "") {
      await pool.query("DELETE FROM budgets WHERE category_id = $1 AND user_id = $2", [categoryId, userId]);
    } else {
      // Only allow limits on categories the user owns.
      const { rowCount } = await pool.query("SELECT 1 FROM categories WHERE id = $1 AND user_id = $2", [categoryId, userId]);
      if (rowCount === 0) return db.getBudgets(userId);
      await pool.query(
        `INSERT INTO budgets (category_id, limit_amount, user_id) VALUES ($1,$2,$3)
         ON CONFLICT (category_id) DO UPDATE SET limit_amount = $2`,
        [categoryId, Number(limit), userId]
      );
    }
    return db.getBudgets(userId);
  },

  // ---- Savings goal ----
  async getGoal(userId) {
    await ensureSchema();
    const { rows } = await pool.query("SELECT * FROM goals WHERE user_id = $1", [userId]);
    if (rows.length === 0 || !rows[0].target_amount) return {};
    return { name: rows[0].name || "Oylik jamg'arma", targetAmount: Number(rows[0].target_amount) };
  },
  async setGoal(userId, goal) {
    await ensureSchema();
    if (!goal || !goal.targetAmount) {
      await pool.query("DELETE FROM goals WHERE user_id = $1", [userId]);
      return {};
    }
    const name = goal.name || "Oylik jamg'arma";
    await pool.query(
      `INSERT INTO goals (user_id, name, target_amount) VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET name = $2, target_amount = $3`,
      [userId, name, Number(goal.targetAmount)]
    );
    return { name, targetAmount: Number(goal.targetAmount) };
  },

  // ---- Inventory ----
  async listInventory(userId, status) {
    await ensureSchema();
    const { rows } = status
      ? await pool.query("SELECT * FROM inventory WHERE user_id = $1 AND status = $2 ORDER BY purchased_at DESC", [userId, status])
      : await pool.query("SELECT * FROM inventory WHERE user_id = $1 ORDER BY purchased_at DESC", [userId]);
    return rows.map(mapInventory);
  },
  async addInventory(userId, item) {
    await ensureSchema();
    const id = nanoid(10);
    const { rows } = await pool.query(
      `INSERT INTO inventory (id, product_id, title, image, category, quantity, purchase_price, purchased_at, status, user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'holding',$9) RETURNING *`,
      [id, item.productId, item.title, item.image, item.category, item.quantity, item.purchasePrice, item.purchasedAt, userId]
    );
    return mapInventory(rows[0]);
  },
  async sellInventory(userId, id, salePrice, soldAt) {
    await ensureSchema();
    const { rows } = await pool.query(
      `UPDATE inventory SET status = 'sold', sold_price = $3, sold_at = $4
       WHERE id = $1 AND user_id = $2 AND status = 'holding' RETURNING *`,
      [id, userId, salePrice, soldAt]
    );
    return rows[0] ? mapInventory(rows[0]) : null;
  },
  async deleteInventory(userId, id) {
    await ensureSchema();
    const { rowCount } = await pool.query("DELETE FROM inventory WHERE id = $1 AND user_id = $2", [id, userId]);
    return rowCount > 0;
  },

  // ---- Orders & payments ----
  // ---- Catalog ----
  async listProducts({ includeInactive = false } = {}) {
    await ensureSchema();
    const { rows } = await pool.query(
      `SELECT * FROM products ${includeInactive ? "" : "WHERE active"} ORDER BY id`
    );
    return rows.map((r) => mapProduct(r, includeInactive));
  },
  async getProducts(ids) {
    await ensureSchema();
    const { rows } = await pool.query("SELECT * FROM products WHERE id = ANY($1::int[]) AND active", [ids]);
    return rows.map((r) => mapProduct(r, true)); // internal use (order pricing); never sent to customers as-is
  },
  async createProduct(p) {
    await ensureSchema();
    const { rows } = await pool.query(
      `INSERT INTO products (title, description, category, price_uzs, image, active, stock, cost_uzs)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [p.title, p.description || null, p.category, p.price, p.image || null, p.active !== false, p.stock ?? null, p.cost ?? null]
    );
    return mapProduct(rows[0], true);
  },
  async updateProduct(id, p) {
    await ensureSchema();
    const { rows } = await pool.query(
      `UPDATE products SET
         title = COALESCE($2, title), description = COALESCE($3, description),
         category = COALESCE($4, category), price_uzs = COALESCE($5, price_uzs),
         image = COALESCE($6, image), active = COALESCE($7, active),
         stock = CASE WHEN $8 THEN $9::int ELSE stock END,
         cost_uzs = CASE WHEN $10 THEN $11::bigint ELSE cost_uzs END
       WHERE id = $1 RETURNING *`,
      [id, p.title ?? null, p.description ?? null, p.category ?? null, p.price ?? null, p.image ?? null, p.active ?? null,
       p.stock !== undefined, p.stock ?? null, p.cost !== undefined, p.cost ?? null]
    );
    return rows[0] ? mapProduct(rows[0], true) : null;
  },

  // Items carry only { productId, quantity }: title, image and price always come from the catalog.
  async createOrder(userId, { items, fullName, phone, address, rate, promoCode = null, discountUzs = 0, deliveryUzs = 0 }) {
    await ensureSchema();
    const subtotal = Math.round(items.reduce((s, i) => s + i.unitPriceUzs * i.quantity, 0));
    const totalUzs = Math.max(0, subtotal - discountUzs) + deliveryUzs;
    const totalUsd = totalUzs / rate; // legacy column, kept for history
    const id = nanoid(10);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO orders (id, user_id, status, total_usd, total_uzs, rate, full_name, phone, address, created_at, promo_code, discount_uzs, delivery_uzs)
         VALUES ($1,$2,'pending',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [id, userId, totalUsd, totalUzs, rate, fullName, phone, address, Date.now(), promoCode, discountUzs, deliveryUzs]
      );
      for (const it of items) {
        await client.query(
          `INSERT INTO order_items (id, order_id, product_id, title, image, category, quantity, unit_price_usd, unit_cost_usd, unit_price_uzs, unit_cost_uzs)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [nanoid(10), id, it.productId || null, it.title, it.image || null, it.category || null, it.quantity, it.unitPriceUzs / rate, it.unitCostUzs == null ? null : it.unitCostUzs / rate, it.unitPriceUzs, it.unitCostUzs ?? null]
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
    return db.getOrder(id);
  },
  // userId = null skips the ownership check (used by the payment provider callback).
  async getOrder(id, userId = null) {
    await ensureSchema();
    const { rows } = userId
      ? await pool.query("SELECT * FROM orders WHERE id = $1 AND user_id = $2", [id, userId])
      : await pool.query("SELECT * FROM orders WHERE id = $1", [id]);
    if (!rows[0]) return null;
    const { rows: items } = await pool.query("SELECT * FROM order_items WHERE order_id = $1", [id]);
    return mapOrder(rows[0], items);
  },
  async listOrders(userId) {
    await ensureSchema();
    const { rows } = await pool.query("SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC", [userId]);
    if (rows.length === 0) return [];
    const { rows: items } = await pool.query("SELECT * FROM order_items WHERE order_id = ANY($1)", [rows.map((r) => r.id)]);
    return rows.map((r) => mapOrder(r, items.filter((i) => i.order_id === r.id)));
  },
  async cancelPendingOrder(userId, id) {
    await ensureSchema();
    const { rowCount } = await pool.query(
      `UPDATE orders SET status = 'cancelled' WHERE id = $1 AND user_id = $2 AND status = 'pending'
       AND NOT EXISTS (SELECT 1 FROM payment_transactions p WHERE p.order_id = $1 AND p.state IN (1, 2))
       AND NOT EXISTS (SELECT 1 FROM click_transactions c WHERE c.order_id = $1 AND c.state = 'prepared')`,
      [id, userId]
    );
    return rowCount > 0;
  },
  // Atomically flips pending -> paid and books the purchase (inventory + expense per item).
  // Returns false if the order was not pending (already paid/cancelled), so it is safe to call twice.
  async markOrderPaid(orderId, provider, ref) {
    await ensureSchema();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        "UPDATE orders SET status = 'paid', provider = $2, provider_ref = $3, paid_at = $4 WHERE id = $1 AND status = 'pending' RETURNING *",
        [orderId, provider, ref || null, Date.now()]
      );
      if (!rows[0]) {
        await client.query("ROLLBACK");
        return false;
      }
      if (rows[0].promo_code) await client.query("UPDATE promos SET used = used + 1 WHERE code = $1", [rows[0].promo_code]);
      const { rows: items } = await client.query("SELECT product_id, quantity FROM order_items WHERE order_id = $1", [orderId]);
      for (const it of items) {
        if (it.product_id != null) {
          await client.query("UPDATE products SET stock = GREATEST(stock - $2, 0) WHERE id = $1 AND stock IS NOT NULL", [it.product_id, it.quantity]);
        }
      }
      await client.query("COMMIT");
      return true;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },
  // Refund of a paid order (provider-initiated cancel): only while the goods have not left the shop.
  async refundPaidOrder(orderId) {
    await ensureSchema();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query("SELECT status, fulfillment FROM orders WHERE id = $1 FOR UPDATE", [orderId]);
      if (!rows[0] || rows[0].status !== "paid" || ["shipped", "delivered"].includes(rows[0].fulfillment)) {
        await client.query("ROLLBACK");
        return false;
      }
      const { rows: items } = await client.query("SELECT product_id, quantity FROM order_items WHERE order_id = $1", [orderId]);
      for (const it of items) {
        if (it.product_id != null) {
          await client.query("UPDATE products SET stock = stock + $2 WHERE id = $1 AND stock IS NOT NULL", [it.product_id, it.quantity]);
        }
      }
      await client.query("DELETE FROM transactions WHERE order_id = $1", [orderId]);
      await client.query("UPDATE promos SET used = GREATEST(used - 1, 0) WHERE code = (SELECT promo_code FROM orders WHERE id = $1)", [orderId]);
      await client.query("UPDATE orders SET status = 'cancelled' WHERE id = $1", [orderId]);
      await client.query("COMMIT");
      return true;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  // Books paid orders into an admin's own ledger: revenue as income, cost of goods as expense.
  // Idempotent (unique per user/order/type), so it can be called on every admin refresh.
  async syncAdminLedger(userId) {
    await ensureSchema();
    const catId = async (type, preferred) => {
      const { rows } = await pool.query(
        "SELECT id FROM categories WHERE user_id = $1 AND type = $2 ORDER BY (name = $3) DESC LIMIT 1",
        [userId, type, preferred]
      );
      return rows[0]?.id || "";
    };
    const incomeCat = await catId("income", "Sotuvdan tushum");
    const expenseCat = await catId("expense", "Tovar xaridi");
    const { rows: orders } = await pool.query(
      `SELECT o.id, o.total_uzs, o.paid_at,
              COALESCE((SELECT SUM(i.quantity * i.unit_cost_uzs) FROM order_items i WHERE i.order_id = o.id), 0) AS cogs
       FROM orders o
       WHERE o.status = 'paid'
         AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.user_id = $1 AND t.order_id = o.id AND t.type = 'income')`,
      [userId]
    );
    for (const o of orders) {
      const when = new Date(Number(o.paid_at) || Date.now()).toISOString();
      await pool.query(
        `INSERT INTO transactions (id, type, amount, category, note, date, created_at, user_id, order_id)
         VALUES ($1,'income',$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
        [nanoid(10), Number(o.total_uzs), incomeCat, `Buyurtma #${o.id}`, when, Date.now(), userId, o.id]
      );
      if (Number(o.cogs) > 0) {
        await pool.query(
          `INSERT INTO transactions (id, type, amount, category, note, date, created_at, user_id, order_id)
           VALUES ($1,'expense',$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
          [nanoid(10), Number(o.cogs), expenseCat, `Tannarx: buyurtma #${o.id}`, when, Date.now(), userId, o.id]
        );
      }
    }
    return orders.length;
  },

  // ---- Company (admin) side ----
  async adminListOrders({ view, q } = {}) {
    await ensureSchema();
    const params = [];
    let search = "";
    if (q) {
      params.push(`%${String(q).toLowerCase()}%`);
      search = ` AND (LOWER(o.full_name) LIKE $1 OR LOWER(o.phone) LIKE $1 OR LOWER(o.id) LIKE $1 OR LOWER(u.email) LIKE $1)`;
    }
    const where =
      view === "unpaid" ? "o.status = 'pending'" :
      view === "cancelled" ? "o.status = 'cancelled'" :
      ["new", "processing", "shipped", "delivered"].includes(view) ? `o.status = 'paid' AND o.fulfillment = '${view}'` :
      "TRUE";
    const { rows } = await pool.query(
      `SELECT o.*, u.email AS customer_email FROM orders o LEFT JOIN users u ON u.id = o.user_id
       WHERE ${where}${search} ORDER BY o.created_at DESC LIMIT 200`,
      params
    );
    if (rows.length === 0) return [];
    const { rows: items } = await pool.query("SELECT * FROM order_items WHERE order_id = ANY($1)", [rows.map((r) => r.id)]);
    return rows.map((r) => mapOrder(r, items.filter((i) => i.order_id === r.id)));
  },
  async adminSetFulfillment(id, fulfillment, note) {
    await ensureSchema();
    const { rowCount } = await pool.query(
      `UPDATE orders SET fulfillment = COALESCE($2, fulfillment), fulfillment_at = $3, admin_note = COALESCE($4, admin_note)
       WHERE id = $1 AND status = 'paid'`,
      [id, fulfillment ?? null, Date.now(), note ?? null]
    );
    return rowCount > 0;
  },
  async adminStats() {
    await ensureSchema();
    const now = Date.now();
    const day = 86400000;
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const sum = async (since) => {
      const { rows } = await pool.query(
        "SELECT COALESCE(SUM(total_uzs),0)::bigint AS uzs, COUNT(*)::int AS n FROM orders WHERE status = 'paid' AND paid_at >= $1",
        [since]
      );
      const { rows: c } = await pool.query(
        `SELECT COALESCE(SUM(i.quantity * i.unit_cost_uzs),0)::bigint AS cogs
         FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.status = 'paid' AND o.paid_at >= $1`,
        [since]
      );
      const cogs = Number(c[0].cogs);
      return { uzs: Number(rows[0].uzs), orders: rows[0].n, cogs, profit: Number(rows[0].uzs) - cogs };
    };
    const [today, week, month, all] = await Promise.all([sum(startOfToday.getTime()), sum(now - 7 * day), sum(now - 30 * day), sum(0)]);
    const { rows: byStatus } = await pool.query(
      `SELECT CASE WHEN status = 'paid' THEN fulfillment ELSE status END AS k, COUNT(*)::int AS n FROM orders GROUP BY 1`
    );
    const { rows: top } = await pool.query(
      `SELECT i.title, i.image, SUM(i.quantity)::int AS qty, SUM(i.quantity * i.unit_price_uzs)::bigint AS uzs
       FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.status = 'paid'
       GROUP BY i.title, i.image ORDER BY qty DESC LIMIT 5`
    );
    const { rows: cust } = await pool.query("SELECT COUNT(*)::int AS n FROM users");
    const { rows: dailyRows } = await pool.query(
      `SELECT to_char(to_timestamp(paid_at / 1000.0), 'YYYY-MM-DD') AS d, SUM(total_uzs)::bigint AS uzs, COUNT(*)::int AS n
       FROM orders WHERE status = 'paid' AND paid_at >= $1 GROUP BY 1`,
      [now - 14 * day]
    );
    const dailyMap = Object.fromEntries(dailyRows.map((r) => [r.d, { uzs: Number(r.uzs), n: r.n }]));
    const daily = [];
    for (let k = 13; k >= 0; k--) {
      const d = new Date(now - k * day);
      const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      daily.push({ date: key, uzs: dailyMap[key]?.uzs || 0, orders: dailyMap[key]?.n || 0 });
    }
    const { rows: low } = await pool.query("SELECT id, title, stock FROM products WHERE active AND stock IS NOT NULL AND stock <= 5 ORDER BY stock LIMIT 10");
    return {
      today, week, month, all,
      byStatus: Object.fromEntries(byStatus.map((r) => [r.k, r.n])),
      top: top.map((t) => ({ title: t.title, image: t.image, qty: t.qty, uzs: Number(t.uzs) })),
      customers: cust[0].n,
      daily,
      lowStock: low,
    };
  },

  async lowStockAmong(ids) {
    await ensureSchema();
    if (!ids.length) return [];
    const { rows } = await pool.query("SELECT id, title, stock FROM products WHERE id = ANY($1::int[]) AND stock IS NOT NULL AND stock <= 3", [ids]);
    return rows;
  },

  // ---- Settings ----
  async getSettings() {
    await ensureSchema();
    const { rows } = await pool.query("SELECT key, value FROM settings");
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  },
  async setSettings(obj) {
    await ensureSchema();
    for (const [k, v] of Object.entries(obj)) {
      await pool.query(
        "INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        [k, String(v)]
      );
    }
  },

  // ---- Product images (stored in the DB: serverless hosting has no writable disk) ----
  async saveProductImage(productId, mime, buffer) {
    await ensureSchema();
    const now = Date.now();
    await pool.query(
      `INSERT INTO product_images (product_id, mime, data, updated_at) VALUES ($1,$2,$3,$4)
       ON CONFLICT (product_id) DO UPDATE SET mime = EXCLUDED.mime, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`,
      [productId, mime, buffer, now]
    );
    await pool.query("UPDATE products SET image = $2 WHERE id = $1", [productId, `/api/products/${productId}/image?v=${now}`]);
  },
  async getProductImage(productId) {
    await ensureSchema();
    const { rows } = await pool.query("SELECT mime, data FROM product_images WHERE product_id = $1", [productId]);
    return rows[0] || null;
  },

  // ---- Promo codes ----
  async listPromos() {
    await ensureSchema();
    const { rows } = await pool.query("SELECT * FROM promos ORDER BY code");
    return rows.map(mapPromo);
  },
  async createPromo(p) {
    await ensureSchema();
    const { rows } = await pool.query(
      `INSERT INTO promos (code, kind, value, min_total, max_uses, expires_at) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (code) DO NOTHING RETURNING *`,
      [p.code, p.kind, p.value, p.minTotal || 0, p.maxUses ?? null, p.expiresAt ?? null]
    );
    return rows[0] ? mapPromo(rows[0]) : null;
  },
  async setPromoActive(code, active) {
    await ensureSchema();
    const { rows } = await pool.query("UPDATE promos SET active = $2 WHERE code = $1 RETURNING *", [code, active]);
    return rows[0] ? mapPromo(rows[0]) : null;
  },
  // Returns { discount } or { error } for a code and an order subtotal.
  async checkPromo(code, subtotal) {
    await ensureSchema();
    const { rows } = await pool.query("SELECT * FROM promos WHERE code = $1", [String(code || "").trim().toUpperCase()]);
    const p = rows[0];
    if (!p || !p.active) return { error: "Promokod topilmadi" };
    if (p.expires_at && Number(p.expires_at) < Date.now()) return { error: "Promokod muddati tugagan" };
    if (p.max_uses != null && p.used >= p.max_uses) return { error: "Promokod limiti tugagan" };
    if (subtotal < Number(p.min_total)) return { error: `Bu promokod ${Number(p.min_total).toLocaleString("en-US")} so'mdan yuqori buyurtmalarga amal qiladi` };
    const raw = p.kind === "percent" ? Math.round((subtotal * Number(p.value)) / 100) : Number(p.value);
    return { code: p.code, discount: Math.min(raw, subtotal) };
  },

  // ---- Reviews ----
  async listReviews(productId) {
    await ensureSchema();
    const { rows } = await pool.query(
      `SELECT r.rating, r.comment, r.created_at, u.email FROM reviews r LEFT JOIN users u ON u.id = r.user_id
       WHERE r.product_id = $1 ORDER BY r.created_at DESC LIMIT 50`,
      [productId]
    );
    return rows.map((r) => ({
      rating: r.rating,
      comment: r.comment || "",
      createdAt: Number(r.created_at),
      author: r.email ? r.email.split("@")[0].slice(0, 2) + "***" : "Mijoz",
    }));
  },
  async myReviewedProductIds(userId) {
    await ensureSchema();
    const { rows } = await pool.query("SELECT product_id FROM reviews WHERE user_id = $1", [userId]);
    return rows.map((r) => r.product_id);
  },
  async hasDelivered(userId, productId) {
    await ensureSchema();
    const { rows } = await pool.query(
      `SELECT 1 FROM orders o JOIN order_items i ON i.order_id = o.id
       WHERE o.user_id = $1 AND i.product_id = $2 AND o.status = 'paid' AND o.fulfillment = 'delivered' LIMIT 1`,
      [userId, productId]
    );
    return rows.length > 0;
  },
  async saveReview(userId, productId, rating, comment) {
    await ensureSchema();
    await pool.query(
      `INSERT INTO reviews (id, product_id, user_id, rating, comment, created_at) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (user_id, product_id) DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = EXCLUDED.created_at`,
      [nanoid(10), productId, userId, rating, comment, Date.now()]
    );
    await pool.query(
      `UPDATE products SET rating_rate = (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE product_id = $1),
                           rating_count = (SELECT COUNT(*) FROM reviews WHERE product_id = $1)
       WHERE id = $1`,
      [productId]
    );
  },

  // ---- Admin: customers & order cancellation ----
  async adminCustomers() {
    await ensureSchema();
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.created_at,
              COUNT(o.id) FILTER (WHERE o.status = 'paid')::int AS orders,
              COALESCE(SUM(o.total_uzs) FILTER (WHERE o.status = 'paid'), 0)::bigint AS spent,
              MAX(o.paid_at) AS last_order
       FROM users u LEFT JOIN orders o ON o.user_id = u.id
       GROUP BY u.id ORDER BY spent DESC, u.created_at DESC LIMIT 200`
    );
    return rows.map((r) => ({
      id: r.id, email: r.email, orders: r.orders, spent: Number(r.spent),
      lastOrder: r.last_order ? Number(r.last_order) : null, joinedAt: Number(r.created_at),
    }));
  },
  async adminOrdersCsv() {
    await ensureSchema();
    const { rows } = await pool.query(
      `SELECT o.*, u.email AS customer_email FROM orders o LEFT JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC`
    );
    const { rows: items } = await pool.query("SELECT * FROM order_items");
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["ID", "Sana", "Holat", "Yetkazish", "Mijoz", "Email", "Telefon", "Manzil", "Tovarlar", "Summa (so'm)", "Chegirma", "Yetkazish narxi", "To'lov"];
    const lines = rows.map((o) =>
      [
        o.id, new Date(Number(o.created_at)).toISOString(), o.status, o.status === "paid" ? o.fulfillment : "", o.full_name, o.customer_email,
        o.phone, o.address,
        items.filter((i) => i.order_id === o.id).map((i) => `${i.quantity}x ${i.title}`).join("; "),
        o.total_uzs, o.discount_uzs, o.delivery_uzs, o.provider,
      ].map(esc).join(",")
    );
    return "﻿" + [head.map(esc).join(","), ...lines].join("\n");
  },

  // ---- Password reset & brute-force limits ----
  async setUserPassword(userId, hash) {
    await ensureSchema();
    await pool.query("UPDATE users SET password_hash = $2 WHERE id = $1", [userId, hash]);
    await pool.query("DELETE FROM password_resets WHERE user_id = $1", [userId]);
  },
  async createResetToken(userId, tokenHash, ttlMs) {
    await ensureSchema();
    await pool.query("DELETE FROM password_resets WHERE user_id = $1 OR expires_at < $2", [userId, Date.now()]);
    await pool.query("INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES ($1,$2,$3)", [tokenHash, userId, Date.now() + ttlMs]);
  },
  async consumeResetToken(tokenHash) {
    await ensureSchema();
    const { rows } = await pool.query("DELETE FROM password_resets WHERE token_hash = $1 RETURNING user_id, expires_at", [tokenHash]);
    if (!rows[0] || Number(rows[0].expires_at) < Date.now()) return null;
    return rows[0].user_id;
  },
  // Returns true if the key is over its limit. `hit` records one attempt.
  async rateLimited(key, { max, windowMs, hit = true }) {
    await ensureSchema();
    const now = Date.now();
    const { rows } = await pool.query(
      hit
        ? `INSERT INTO auth_attempts (key, count, reset_at) VALUES ($1, 1, $2)
           ON CONFLICT (key) DO UPDATE SET
             count = CASE WHEN auth_attempts.reset_at < $3 THEN 1 ELSE auth_attempts.count + 1 END,
             reset_at = CASE WHEN auth_attempts.reset_at < $3 THEN $2 ELSE auth_attempts.reset_at END
           RETURNING count`
        : `SELECT count FROM auth_attempts WHERE key = $1 AND reset_at >= $2`,
      hit ? [key, now + windowMs, now] : [key, now]
    );
    return (rows[0]?.count || 0) > max;
  },
  async clearRateLimit(key) {
    await ensureSchema();
    await pool.query("DELETE FROM auth_attempts WHERE key = $1", [key]);
  },

  // ---- Click transactions ----
  async getClickTx(clickTransId) {
    await ensureSchema();
    const { rows } = await pool.query("SELECT * FROM click_transactions WHERE click_trans_id = $1", [String(clickTransId)]);
    return rows[0] || null;
  },
  async createClickTx({ clickTransId, orderId, amount }) {
    await ensureSchema();
    const { rows } = await pool.query(
      `INSERT INTO click_transactions (click_trans_id, prepare_id, order_id, amount, state, created_at)
       VALUES ($1,$2,$3,$4,'prepared',$5) RETURNING *`,
      [String(clickTransId), nanoid(12), orderId, amount, Date.now()]
    );
    return rows[0];
  },
  async setClickTxState(clickTransId, state) {
    await ensureSchema();
    await pool.query("UPDATE click_transactions SET state = $2 WHERE click_trans_id = $1", [String(clickTransId), state]);
  },

  async getPayment(id) {
    await ensureSchema();
    const { rows } = await pool.query("SELECT * FROM payment_transactions WHERE id = $1", [id]);
    return rows[0] ? mapPayment(rows[0]) : null;
  },
  async getActivePaymentForOrder(orderId) {
    await ensureSchema();
    const { rows } = await pool.query("SELECT * FROM payment_transactions WHERE order_id = $1 AND state IN (1, 2)", [orderId]);
    return rows[0] ? mapPayment(rows[0]) : null;
  },
  async createPayment({ id, orderId, amount, time }) {
    await ensureSchema();
    const { rows } = await pool.query(
      "INSERT INTO payment_transactions (id, order_id, amount, state, create_time) VALUES ($1,$2,$3,1,$4) RETURNING *",
      [id, orderId, amount, time]
    );
    return mapPayment(rows[0]);
  },
  async updatePayment(id, { state, reason, performTime, cancelTime }) {
    await ensureSchema();
    const { rows } = await pool.query(
      `UPDATE payment_transactions SET state = $2, reason = COALESCE($3, reason),
         perform_time = COALESCE($4, perform_time), cancel_time = COALESCE($5, cancel_time)
       WHERE id = $1 RETURNING *`,
      [id, state, reason ?? null, performTime ?? null, cancelTime ?? null]
    );
    return rows[0] ? mapPayment(rows[0]) : null;
  },
  async listPayments(from, to) {
    await ensureSchema();
    const { rows } = await pool.query(
      "SELECT * FROM payment_transactions WHERE create_time BETWEEN $1 AND $2 ORDER BY create_time ASC",
      [from, to]
    );
    return rows.map(mapPayment);
  },
};
