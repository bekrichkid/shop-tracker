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
      `);
      const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM categories");
      if (rows[0].n === 0) {
        for (const c of DEFAULT_CATEGORIES) {
          await pool.query("INSERT INTO categories (id, name, type, color) VALUES ($1,$2,$3,$4)", [
            nanoid(8),
            c.name,
            c.type,
            c.color,
          ]);
        }
      }
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

export const db = {
  // Transactions
  async listTransactions() {
    await ensureSchema();
    const { rows } = await pool.query("SELECT * FROM transactions ORDER BY date DESC, created_at DESC");
    return rows.map(mapTransaction);
  },
  async addTransaction(tx) {
    await ensureSchema();
    const id = nanoid(10);
    const { rows } = await pool.query(
      `INSERT INTO transactions (id, type, amount, category, note, date, created_at, inventory_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [id, tx.type, Number(tx.amount), tx.category, tx.note || "", tx.date, Date.now(), tx.inventoryId || null]
    );
    return mapTransaction(rows[0]);
  },
  async deleteTransaction(id) {
    await ensureSchema();
    const { rowCount } = await pool.query("DELETE FROM transactions WHERE id = $1", [id]);
    return rowCount > 0;
  },

  // Categories
  async listCategories() {
    await ensureSchema();
    const { rows } = await pool.query("SELECT * FROM categories ORDER BY type, name");
    return rows.map(mapCategory);
  },
  async addCategory(cat) {
    await ensureSchema();
    const id = nanoid(8);
    const { rows } = await pool.query(
      "INSERT INTO categories (id, name, type, color) VALUES ($1,$2,$3,$4) RETURNING *",
      [id, cat.name, cat.type, cat.color || "#777777"]
    );
    return mapCategory(rows[0]);
  },
  async deleteCategory(id) {
    await ensureSchema();
    const { rowCount } = await pool.query("DELETE FROM categories WHERE id = $1", [id]);
    return rowCount > 0;
  },

  // Budgets
  async getBudgets() {
    await ensureSchema();
    const { rows } = await pool.query("SELECT * FROM budgets");
    return Object.fromEntries(rows.map((r) => [r.category_id, Number(r.limit_amount)]));
  },
  async setBudget(categoryId, limit) {
    await ensureSchema();
    if (limit === null || limit === undefined || limit === "") {
      await pool.query("DELETE FROM budgets WHERE category_id = $1", [categoryId]);
    } else {
      await pool.query(
        `INSERT INTO budgets (category_id, limit_amount) VALUES ($1,$2)
         ON CONFLICT (category_id) DO UPDATE SET limit_amount = $2`,
        [categoryId, Number(limit)]
      );
    }
    return db.getBudgets();
  },

  // Savings goal
  async getGoal() {
    await ensureSchema();
    const { rows } = await pool.query("SELECT * FROM goal WHERE id = 1");
    if (rows.length === 0 || !rows[0].target_amount) return {};
    return { name: rows[0].name || "Oylik jamg'arma", targetAmount: Number(rows[0].target_amount) };
  },
  async setGoal(goal) {
    await ensureSchema();
    if (!goal || !goal.targetAmount) {
      await pool.query("DELETE FROM goal WHERE id = 1");
      return {};
    }
    const name = goal.name || "Oylik jamg'arma";
    await pool.query(
      `INSERT INTO goal (id, name, target_amount) VALUES (1, $1, $2)
       ON CONFLICT (id) DO UPDATE SET name = $1, target_amount = $2`,
      [name, Number(goal.targetAmount)]
    );
    return { name, targetAmount: Number(goal.targetAmount) };
  },

  // Inventory (bought products, holding or sold)
  async listInventory(status) {
    await ensureSchema();
    const { rows } = status
      ? await pool.query("SELECT * FROM inventory WHERE status = $1 ORDER BY purchased_at DESC", [status])
      : await pool.query("SELECT * FROM inventory ORDER BY purchased_at DESC");
    return rows.map(mapInventory);
  },
  async addInventory(item) {
    await ensureSchema();
    const id = nanoid(10);
    const { rows } = await pool.query(
      `INSERT INTO inventory (id, product_id, title, image, category, quantity, purchase_price, purchased_at, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'holding') RETURNING *`,
      [id, item.productId, item.title, item.image, item.category, item.quantity, item.purchasePrice, item.purchasedAt]
    );
    return mapInventory(rows[0]);
  },
  async sellInventory(id, salePrice, soldAt) {
    await ensureSchema();
    const { rows } = await pool.query(
      `UPDATE inventory SET status = 'sold', sold_price = $2, sold_at = $3
       WHERE id = $1 AND status = 'holding' RETURNING *`,
      [id, salePrice, soldAt]
    );
    return rows[0] ? mapInventory(rows[0]) : null;
  },
  async deleteInventory(id) {
    await ensureSchema();
    const { rowCount } = await pool.query("DELETE FROM inventory WHERE id = $1", [id]);
    return rowCount > 0;
  },
};
