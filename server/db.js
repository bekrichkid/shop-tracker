import pg from "pg";
import { nanoid } from "nanoid";

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
        CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id);
        CREATE INDEX IF NOT EXISTS idx_inv_user ON inventory(user_id);
        CREATE INDEX IF NOT EXISTS idx_cat_user ON categories(user_id);
      `);
    })();
  }
  return schemaReady;
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
};
