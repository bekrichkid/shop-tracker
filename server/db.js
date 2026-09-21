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
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment TEXT NOT NULL DEFAULT 'new';
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_at BIGINT;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_note TEXT;
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
            `INSERT INTO products (id, title, description, category, price_usd, image, rating_rate, rating_count)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
            [p.id, p.title, p.description, p.category, p.priceUsd, p.image, p.ratingRate, p.ratingCount]
          );
        }
        await pool.query("SELECT setval(pg_get_serial_sequence('products','id'), (SELECT MAX(id) FROM products))");
      }
    })();
  }
  return schemaReady;
}

function mapProduct(r) {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    price: Number(r.price_usd),
    image: r.image,
    rating: r.rating_rate == null ? null : { rate: Number(r.rating_rate), count: r.rating_count },
    stock: r.stock,
    active: r.active,
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
    totalUsd: Number(r.total_usd),
    totalUzs: Number(r.total_uzs),
    fullName: r.full_name,
    phone: r.phone,
    address: r.address,
    provider: r.provider,
    createdAt: Number(r.created_at),
    paidAt: r.paid_at ? Number(r.paid_at) : null,
    fulfillment: r.fulfillment || "new",
    fulfillmentAt: r.fulfillment_at ? Number(r.fulfillment_at) : null,
    adminNote: r.admin_note || "",
    customerEmail: r.customer_email,
    items: (items || []).map((i) => ({
      productId: i.product_id,
      title: i.title,
      image: i.image,
      quantity: i.quantity,
      unitPriceUsd: Number(i.unit_price_usd),
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
    await pool.query("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1)", [userId]);
    await pool.query("DELETE FROM orders WHERE user_id = $1", [userId]);
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
    return rows.map(mapProduct);
  },
  async getProducts(ids) {
    await ensureSchema();
    const { rows } = await pool.query("SELECT * FROM products WHERE id = ANY($1::int[]) AND active", [ids]);
    return rows.map(mapProduct);
  },
  async createProduct(p) {
    await ensureSchema();
    const { rows } = await pool.query(
      `INSERT INTO products (title, description, category, price_usd, image, active, stock)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [p.title, p.description || null, p.category, p.price, p.image || null, p.active !== false, p.stock ?? null]
    );
    return mapProduct(rows[0]);
  },
  async updateProduct(id, p) {
    await ensureSchema();
    const { rows } = await pool.query(
      `UPDATE products SET
         title = COALESCE($2, title), description = COALESCE($3, description),
         category = COALESCE($4, category), price_usd = COALESCE($5, price_usd),
         image = COALESCE($6, image), active = COALESCE($7, active),
         stock = CASE WHEN $8 THEN $9::int ELSE stock END
       WHERE id = $1 RETURNING *`,
      [id, p.title ?? null, p.description ?? null, p.category ?? null, p.price ?? null, p.image ?? null, p.active ?? null,
       p.stock !== undefined, p.stock ?? null]
    );
    return rows[0] ? mapProduct(rows[0]) : null;
  },

  // Items carry only { productId, quantity }: title, image and price always come from the catalog.
  async createOrder(userId, { items, fullName, phone, address, rate }) {
    await ensureSchema();
    const totalUsd = items.reduce((s, i) => s + i.unitPriceUsd * i.quantity, 0);
    const totalUzs = Math.round(totalUsd * rate);
    const id = nanoid(10);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO orders (id, user_id, status, total_usd, total_uzs, rate, full_name, phone, address, created_at)
         VALUES ($1,$2,'pending',$3,$4,$5,$6,$7,$8,$9)`,
        [id, userId, totalUsd, totalUzs, rate, fullName, phone, address, Date.now()]
      );
      for (const it of items) {
        await client.query(
          `INSERT INTO order_items (id, order_id, product_id, title, image, category, quantity, unit_price_usd)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [nanoid(10), id, it.productId || null, it.title, it.image || null, it.category || null, it.quantity, it.unitPriceUsd]
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
       AND NOT EXISTS (SELECT 1 FROM payment_transactions p WHERE p.order_id = $1 AND p.state IN (1, 2))`,
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
      const order = rows[0];
      const { rows: items } = await client.query("SELECT * FROM order_items WHERE order_id = $1", [orderId]);
      const catQ = await client.query(
        "SELECT id FROM categories WHERE user_id = $1 AND type = 'expense' ORDER BY (name = 'Tovar xaridi') DESC LIMIT 1",
        [order.user_id]
      );
      const categoryId = catQ.rows[0]?.id || "";
      const when = new Date().toISOString();
      for (const it of items) {
        if (it.product_id != null) {
          await client.query("UPDATE products SET stock = GREATEST(stock - $2, 0) WHERE id = $1 AND stock IS NOT NULL", [it.product_id, it.quantity]);
        }
        const invId = nanoid(10);
        await client.query(
          `INSERT INTO inventory (id, product_id, title, image, category, quantity, purchase_price, purchased_at, status, user_id, order_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'holding',$9,$10)`,
          [invId, it.product_id, it.title, it.image, it.category, it.quantity, it.unit_price_usd, when, order.user_id, orderId]
        );
        await client.query(
          `INSERT INTO transactions (id, type, amount, category, note, date, created_at, inventory_id, user_id)
           VALUES ($1,'expense',$2,$3,$4,$5,$6,$7,$8)`,
          [nanoid(10), Number(it.unit_price_usd) * it.quantity, categoryId, `Xarid: ${it.title}`, when, Date.now(), invId, order.user_id]
        );
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
  // Refund of a paid order: only possible while none of its goods were sold.
  async refundPaidOrder(orderId) {
    await ensureSchema();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows: inv } = await client.query("SELECT id, status FROM inventory WHERE order_id = $1", [orderId]);
      if (inv.some((i) => i.status !== "holding")) {
        await client.query("ROLLBACK");
        return false;
      }
      const ids = inv.map((i) => i.id);
      const { rows: ordItems } = await client.query("SELECT product_id, quantity FROM order_items WHERE order_id = $1", [orderId]);
      for (const it of ordItems) {
        if (it.product_id != null) {
          await client.query("UPDATE products SET stock = stock + $2 WHERE id = $1 AND stock IS NOT NULL", [it.product_id, it.quantity]);
        }
      }
      await client.query("DELETE FROM transactions WHERE inventory_id = ANY($1)", [ids]);
      await client.query("DELETE FROM inventory WHERE order_id = $1", [orderId]);
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

  // ---- Company (admin) side ----
  async adminListOrders({ view } = {}) {
    await ensureSchema();
    const where =
      view === "unpaid" ? "o.status = 'pending'" :
      view === "cancelled" ? "o.status = 'cancelled'" :
      ["new", "processing", "shipped", "delivered"].includes(view) ? `o.status = 'paid' AND o.fulfillment = '${view}'` :
      "TRUE";
    const { rows } = await pool.query(
      `SELECT o.*, u.email AS customer_email FROM orders o LEFT JOIN users u ON u.id = o.user_id
       WHERE ${where} ORDER BY o.created_at DESC LIMIT 200`
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
      return { uzs: Number(rows[0].uzs), orders: rows[0].n };
    };
    const [today, week, month, all] = await Promise.all([sum(startOfToday.getTime()), sum(now - 7 * day), sum(now - 30 * day), sum(0)]);
    const { rows: byStatus } = await pool.query(
      `SELECT CASE WHEN status = 'paid' THEN fulfillment ELSE status END AS k, COUNT(*)::int AS n FROM orders GROUP BY 1`
    );
    const { rows: top } = await pool.query(
      `SELECT i.title, i.image, SUM(i.quantity)::int AS qty, SUM(i.quantity * i.unit_price_usd * o.rate)::bigint AS uzs
       FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.status = 'paid'
       GROUP BY i.title, i.image ORDER BY qty DESC LIMIT 5`
    );
    const { rows: cust } = await pool.query("SELECT COUNT(*)::int AS n FROM users");
    const { rows: low } = await pool.query("SELECT id, title, stock FROM products WHERE active AND stock IS NOT NULL AND stock <= 5 ORDER BY stock LIMIT 10");
    return {
      today, week, month, all,
      byStatus: Object.fromEntries(byStatus.map((r) => [r.k, r.n])),
      top: top.map((t) => ({ title: t.title, image: t.image, qty: t.qty, uzs: Number(t.uzs) })),
      customers: cust[0].n,
      lowStock: low,
    };
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
