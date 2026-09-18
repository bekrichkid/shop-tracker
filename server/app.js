import express from "express";
import cors from "cors";
import { db } from "./db.js";

export const app = express();

app.use(cors());
app.use(express.json());

const PRODUCTS_API = "https://fakestoreapi.com";
// FakeStoreAPI rejects requests without a browser-like User-Agent (403) — Node's default fetch sends none.
const UPSTREAM_HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; shop-tracker/1.0)", Accept: "application/json" };

function summarize(transactions) {
  const income = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  return { income, expense, balance: income - expense, count: transactions.length };
}

function inRange(dateStr, from, to) {
  const d = new Date(dateStr).getTime();
  if (from && d < new Date(from).getTime()) return false;
  if (to && d > new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1) return false;
  return true;
}

// ---- Products (proxied from FakeStoreAPI so the frontend never talks to a 3rd party directly) ----
app.get("/api/products", async (req, res, next) => {
  try {
    const { category } = req.query;
    const url = category
      ? `${PRODUCTS_API}/products/category/${encodeURIComponent(category)}`
      : `${PRODUCTS_API}/products`;
    const upstream = await fetch(url, { headers: UPSTREAM_HEADERS });
    if (!upstream.ok) throw new Error(`FakeStoreAPI ${upstream.status}`);
    const products = await upstream.json();
    res.json(
      products.map((p) => ({
        id: p.id,
        title: p.title,
        price: p.price,
        description: p.description,
        category: p.category,
        image: p.image,
        rating: p.rating,
      }))
    );
  } catch (err) {
    next(err);
  }
});

app.get("/api/products/categories", async (req, res, next) => {
  try {
    const upstream = await fetch(`${PRODUCTS_API}/products/categories`, { headers: UPSTREAM_HEADERS });
    if (!upstream.ok) throw new Error(`FakeStoreAPI ${upstream.status}`);
    res.json(await upstream.json());
  } catch (err) {
    next(err);
  }
});

// ---- Categories ----
app.get("/api/categories", async (req, res, next) => {
  try {
    res.json(await db.listCategories());
  } catch (err) {
    next(err);
  }
});

app.post("/api/categories", async (req, res, next) => {
  try {
    const { name, type, color } = req.body;
    if (!name || !["income", "expense"].includes(type)) {
      return res.status(400).json({ error: "name va type (income|expense) majburiy" });
    }
    res.status(201).json(await db.addCategory({ name, type, color }));
  } catch (err) {
    next(err);
  }
});

app.delete("/api/categories/:id", async (req, res, next) => {
  try {
    const ok = await db.deleteCategory(req.params.id);
    if (!ok) return res.status(404).json({ error: "topilmadi" });
    await db.setBudget(req.params.id, null);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---- Budgets ----
app.get("/api/budgets", async (req, res, next) => {
  try {
    res.json(await db.getBudgets());
  } catch (err) {
    next(err);
  }
});

app.put("/api/budgets/:categoryId", async (req, res, next) => {
  try {
    res.json(await db.setBudget(req.params.categoryId, req.body.limit));
  } catch (err) {
    next(err);
  }
});

// ---- Savings goal ----
app.get("/api/goal", async (req, res, next) => {
  try {
    res.json(await db.getGoal());
  } catch (err) {
    next(err);
  }
});

app.put("/api/goal", async (req, res, next) => {
  try {
    res.json(await db.setGoal(req.body));
  } catch (err) {
    next(err);
  }
});

// ---- Transactions ----
app.get("/api/transactions", async (req, res, next) => {
  try {
    const { type, category, from, to, q } = req.query;
    let list = await db.listTransactions();
    if (type) list = list.filter((t) => t.type === type);
    if (category) list = list.filter((t) => t.category === category);
    if (from || to) list = list.filter((t) => inRange(t.date, from, to));
    if (q) {
      const needle = String(q).toLowerCase();
      list = list.filter((t) => (t.note || "").toLowerCase().includes(needle));
    }
    res.json(list);
  } catch (err) {
    next(err);
  }
});

app.post("/api/transactions", async (req, res, next) => {
  try {
    const { type, amount, category, note, date } = req.body;
    if (!["income", "expense"].includes(type)) return res.status(400).json({ error: "type income yoki expense bo'lishi kerak" });
    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: "amount musbat son bo'lishi kerak" });
    if (!category) return res.status(400).json({ error: "category majburiy" });
    const record = await db.addTransaction({ type, amount, category, note, date: date || new Date().toISOString() });
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

app.delete("/api/transactions/:id", async (req, res, next) => {
  try {
    const ok = await db.deleteTransaction(req.params.id);
    if (!ok) return res.status(404).json({ error: "topilmadi" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.get("/api/summary", async (req, res, next) => {
  try {
    const { period } = req.query;
    const all = await db.listTransactions();
    const now = new Date();
    let from = null;
    if (period === "today") from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    else if (period === "week") {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      from = d.toISOString();
    } else if (period === "month") from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const filtered = from ? all.filter((t) => new Date(t.date) >= new Date(from)) : all;
    res.json(summarize(filtered));
  } catch (err) {
    next(err);
  }
});

app.get("/api/export/csv", async (req, res, next) => {
  try {
    const list = await db.listTransactions();
    const header = "sana,turi,kategoriya,summa,izoh\n";
    const rows = list
      .map((t) => `${t.date},${t.type},${t.category},${t.amount},"${(t.note || "").replace(/"/g, '""')}"`)
      .join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=tranzaksiyalar.csv");
    res.send(header + rows);
  } catch (err) {
    next(err);
  }
});

// ---- Inventory (buy / sell products) ----
app.get("/api/inventory", async (req, res, next) => {
  try {
    res.json(await db.listInventory(req.query.status));
  } catch (err) {
    next(err);
  }
});

// Buying a product: adds it to inventory AND logs an expense transaction in one step.
app.post("/api/inventory/buy", async (req, res, next) => {
  try {
    const { productId, title, image, category, quantity, purchasePrice } = req.body;
    if (!title) return res.status(400).json({ error: "title majburiy" });
    if (!purchasePrice || Number(purchasePrice) <= 0) return res.status(400).json({ error: "purchasePrice musbat son bo'lishi kerak" });
    const qty = Number(quantity) || 1;
    const purchasedAt = new Date().toISOString();

    const item = await db.addInventory({
      productId: productId || null,
      title,
      image: image || null,
      category: category || null,
      quantity: qty,
      purchasePrice: Number(purchasePrice),
      purchasedAt,
    });

    const categories = await db.listCategories();
    const expenseCat = categories.find((c) => c.name === "Tovar xaridi" && c.type === "expense") || categories.find((c) => c.type === "expense");
    const tx = await db.addTransaction({
      type: "expense",
      amount: Number(purchasePrice) * qty,
      category: expenseCat?.id,
      note: `Xarid: ${title}`,
      date: purchasedAt,
      inventoryId: item.id,
    });

    res.status(201).json({ item, transaction: tx });
  } catch (err) {
    next(err);
  }
});

// Selling a held item: marks it sold AND logs an income transaction in one step.
app.post("/api/inventory/:id/sell", async (req, res, next) => {
  try {
    const { salePrice } = req.body;
    if (!salePrice || Number(salePrice) <= 0) return res.status(400).json({ error: "salePrice musbat son bo'lishi kerak" });
    const soldAt = new Date().toISOString();
    const item = await db.sellInventory(req.params.id, Number(salePrice), soldAt);
    if (!item) return res.status(404).json({ error: "topilmadi yoki allaqachon sotilgan" });

    const categories = await db.listCategories();
    const incomeCat = categories.find((c) => c.name === "Sotuvdan tushum" && c.type === "income") || categories.find((c) => c.type === "income");
    const tx = await db.addTransaction({
      type: "income",
      amount: Number(salePrice),
      category: incomeCat?.id,
      note: `Sotuv: ${item.title}`,
      date: soldAt,
      inventoryId: item.id,
    });

    const profit = Number(salePrice) - item.purchasePrice * item.quantity;
    res.json({ item, transaction: tx, profit });
  } catch (err) {
    next(err);
  }
});

app.delete("/api/inventory/:id", async (req, res, next) => {
  try {
    const ok = await db.deleteInventory(req.params.id);
    if (!ok) return res.status(404).json({ error: "topilmadi" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Server xatosi" });
});
