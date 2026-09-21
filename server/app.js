import crypto from "crypto";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "./db.js";
import { paymeHandler } from "./payme.js";
import { notifyOrderPaid } from "./notify.js";
import { paymentConfig, paymeCheckoutUrl } from "./payments.js";

export const app = express();

app.use(cors());
app.use(express.json());

// JWT_SECRET should be set in production; otherwise derive a stable secret from DATABASE_URL
// so deploys work without an extra manual step.
const JWT_SECRET =
  process.env.JWT_SECRET || crypto.createHash("sha256").update(`shop-tracker-jwt:${process.env.DATABASE_URL || "dev"}`).digest("hex");
const TOKEN_TTL = "30d";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(user) {
  return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
const isAdminEmail = (email) => ADMIN_EMAILS.includes(String(email).toLowerCase());
const publicUser = (u) => ({ id: u.id, email: u.email, isAdmin: isAdminEmail(u.email) });

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Kirish talab qilinadi" });
  try {
    req.userId = jwt.verify(token, JWT_SECRET).sub;
    next();
  } catch {
    res.status(401).json({ error: "Sessiya tugagan, qayta kiring" });
  }
}

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

// Note: product catalog browsing is fetched directly from FakeStoreAPI by the client
// (see client/src/api.js) — Netlify Functions' server IPs get 403'd by its Cloudflare
// bot protection, but real browser requests are allowed.

app.get("/api/health", (req, res) => res.json({ ok: true }));

// ---- Auth ----
function validateCredentials(email, password) {
  if (!email || !EMAIL_RE.test(email)) return "Email noto'g'ri";
  if (!password || password.length < 8) return "Parol kamida 8 belgidan iborat bo'lishi kerak";
  return null;
}

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const problem = validateCredentials(email, password);
    if (problem) return res.status(400).json({ error: problem });
    if (await db.findUserByEmail(email)) return res.status(409).json({ error: "Bu email allaqachon ro'yxatdan o'tgan" });
    const user = await db.createUser(email, await bcrypt.hash(password, 10));
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const user = await db.findUserByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Email yoki parol noto'g'ri" });
    }
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

app.get("/api/auth/me", requireAuth, async (req, res, next) => {
  try {
    const user = await db.findUserById(req.userId);
    if (!user) return res.status(401).json({ error: "Foydalanuvchi topilmadi" });
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// Apple App Store requires in-app account deletion.
app.delete("/api/auth/account", requireAuth, async (req, res, next) => {
  try {
    await db.deleteUserAndData(req.userId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Payment provider callback: authenticated by the provider's own Basic credentials, not a user JWT.
app.post("/api/payme", paymeHandler);

// Public shop contact details (set in env) for the support screen.
app.get("/api/store", (req, res) => {
  res.json({
    name: process.env.STORE_NAME || "Tovar Do'koni",
    phone: process.env.SUPPORT_PHONE || "",
    telegram: process.env.SUPPORT_TELEGRAM || "",
    hours: process.env.SUPPORT_HOURS || "",
  });
});

// Public catalog (prices are authoritative here; orders never trust client-sent prices).
app.get("/api/products", async (req, res, next) => {
  try {
    res.set("Cache-Control", "public, max-age=60");
    res.json(await db.listProducts());
  } catch (err) {
    next(err);
  }
});

// Everything below requires a logged-in user.
app.use("/api", requireAuth);

// ---- Payments & orders ----
app.get("/api/payments/config", (req, res) => {
  const { payme, demo, rate } = paymentConfig();
  res.json({ providers: [...(payme ? ["payme"] : []), ...(demo ? ["demo"] : [])], rate });
});

const PHONE_RE = /^\+?[0-9\s()-]{9,18}$/;

app.post("/api/orders", async (req, res, next) => {
  try {
    const { items, fullName, phone, address } = req.body;
    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
      return res.status(400).json({ error: "Savat bo'sh yoki juda katta" });
    }
    const wanted = new Map();
    for (const it of items) {
      const productId = Number(it.productId);
      const quantity = Number(it.quantity);
      if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
        return res.status(400).json({ error: "Savatdagi tovar ma'lumoti noto'g'ri" });
      }
      wanted.set(productId, (wanted.get(productId) || 0) + quantity);
    }
    const found = await db.getProducts([...wanted.keys()]);
    if (found.length !== wanted.size) {
      return res.status(400).json({ error: "Savatdagi ba'zi tovarlar endi sotuvda yo'q. Savatni yangilang" });
    }
    for (const p of found) {
      if (p.stock !== null && p.stock !== undefined && wanted.get(p.id) > p.stock) {
        return res.status(409).json({ error: p.stock > 0 ? `"${p.title}" dan omborda faqat ${p.stock} dona qoldi` : `"${p.title}" tugagan` });
      }
    }
    const clean = found.map((p) => ({
      productId: p.id,
      title: p.title,
      image: p.image,
      category: p.category,
      quantity: Math.min(100, wanted.get(p.id)),
      unitPriceUsd: p.price,
    }));
    if (!fullName || String(fullName).trim().length < 2) return res.status(400).json({ error: "Ism-familiyani kiriting" });
    if (!PHONE_RE.test(String(phone || ""))) return res.status(400).json({ error: "Telefon raqami noto'g'ri" });
    if (!address || String(address).trim().length < 5) return res.status(400).json({ error: "Yetkazib berish manzilini kiriting" });

    const order = await db.createOrder(req.userId, {
      items: clean,
      fullName: String(fullName).trim(),
      phone: String(phone).trim(),
      address: String(address).trim(),
      rate: paymentConfig().rate,
    });
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

// ---- Catalog admin (only emails listed in ADMIN_EMAILS) ----
async function requireAdmin(req, res, next) {
  try {
    const user = await db.findUserById(req.userId);
    if (!user || !isAdminEmail(user.email)) return res.status(403).json({ error: "Ruxsat yo'q" });
    next();
  } catch (err) {
    next(err);
  }
}

function parseProduct(body, { partial }) {
  const out = {};
  if (body.title !== undefined || !partial) {
    const t = String(body.title || "").trim();
    if (t.length < 2 || t.length > 300) return { error: "Tovar nomi 2–300 belgi bo'lishi kerak" };
    out.title = t;
  }
  if (body.category !== undefined || !partial) {
    const c = String(body.category || "").trim();
    if (!c || c.length > 100) return { error: "Kategoriyani kiriting" };
    out.category = c;
  }
  if (body.price !== undefined || !partial) {
    const price = Number(body.price);
    if (!(price > 0) || price > 1e7) return { error: "Narx noto'g'ri" };
    out.price = price;
  }
  if (body.description !== undefined) out.description = String(body.description).slice(0, 2000);
  if (body.image !== undefined) out.image = String(body.image).slice(0, 500);
  if (body.active !== undefined) out.active = Boolean(body.active);
  if (body.stock !== undefined) {
    if (body.stock === null || body.stock === "") out.stock = null;
    else {
      const st = Number(body.stock);
      if (!Number.isInteger(st) || st < 0 || st > 1e6) return { error: "Zaxira noto'g'ri" };
      out.stock = st;
    }
  }
  return { value: out };
}

app.get("/api/admin/products", requireAdmin, async (req, res, next) => {
  try {
    res.json(await db.listProducts({ includeInactive: true }));
  } catch (err) {
    next(err);
  }
});

app.post("/api/admin/products", requireAdmin, async (req, res, next) => {
  try {
    const { value, error } = parseProduct(req.body, { partial: false });
    if (error) return res.status(400).json({ error });
    res.status(201).json(await db.createProduct(value));
  } catch (err) {
    next(err);
  }
});

app.put("/api/admin/products/:id", requireAdmin, async (req, res, next) => {
  try {
    const { value, error } = parseProduct(req.body, { partial: true });
    if (error) return res.status(400).json({ error });
    const updated = await db.updateProduct(Number(req.params.id), value);
    if (!updated) return res.status(404).json({ error: "Tovar topilmadi" });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

const FULFILLMENT = ["new", "processing", "shipped", "delivered"];

app.get("/api/admin/orders", requireAdmin, async (req, res, next) => {
  try {
    res.json(await db.adminListOrders({ view: String(req.query.view || "") }));
  } catch (err) {
    next(err);
  }
});

app.put("/api/admin/orders/:id", requireAdmin, async (req, res, next) => {
  try {
    const { fulfillment, note } = req.body;
    if (fulfillment !== undefined && !FULFILLMENT.includes(fulfillment)) return res.status(400).json({ error: "Holat noto'g'ri" });
    const ok = await db.adminSetFulfillment(req.params.id, fulfillment, note === undefined ? undefined : String(note).slice(0, 500));
    if (!ok) return res.status(404).json({ error: "To'langan buyurtma topilmadi" });
    res.json(await db.getOrder(req.params.id));
  } catch (err) {
    next(err);
  }
});

app.get("/api/admin/stats", requireAdmin, async (req, res, next) => {
  try {
    res.json(await db.adminStats());
  } catch (err) {
    next(err);
  }
});

app.get("/api/orders", async (req, res, next) => {
  try {
    res.json(await db.listOrders(req.userId));
  } catch (err) {
    next(err);
  }
});

app.get("/api/orders/:id", async (req, res, next) => {
  try {
    const order = await db.getOrder(req.params.id, req.userId);
    if (!order) return res.status(404).json({ error: "Buyurtma topilmadi" });
    res.json(order);
  } catch (err) {
    next(err);
  }
});

app.post("/api/orders/:id/pay", async (req, res, next) => {
  try {
    const order = await db.getOrder(req.params.id, req.userId);
    if (!order) return res.status(404).json({ error: "Buyurtma topilmadi" });
    if (order.status !== "pending") return res.status(409).json({ error: "Buyurtma allaqachon to'langan yoki bekor qilingan" });
    const { payme, demo } = paymentConfig();
    const provider = req.body.provider;

    if (provider === "payme" && payme) {
      const returnUrl = process.env.APP_URL || req.headers.origin || "";
      const base = returnUrl ? `${returnUrl.replace(/\/$/, "")}/?order=${order.id}` : "";
      return res.json({ payUrl: paymeCheckoutUrl(order, base) });
    }
    if (provider === "demo" && demo) {
      if (await db.markOrderPaid(order.id, "demo", null)) await notifyOrderPaid(order.id);
      return res.json({ status: "paid" });
    }
    res.status(400).json({ error: "To'lov usuli mavjud emas" });
  } catch (err) {
    next(err);
  }
});

app.post("/api/orders/:id/cancel", async (req, res, next) => {
  try {
    const ok = await db.cancelPendingOrder(req.userId, req.params.id);
    if (!ok) return res.status(409).json({ error: "Buyurtmani bekor qilib bo'lmaydi" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---- Categories ----
app.get("/api/categories", async (req, res, next) => {
  try {
    res.json(await db.listCategories(req.userId));
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
    res.status(201).json(await db.addCategory(req.userId, { name, type, color }));
  } catch (err) {
    next(err);
  }
});

app.delete("/api/categories/:id", async (req, res, next) => {
  try {
    const ok = await db.deleteCategory(req.userId, req.params.id);
    if (!ok) return res.status(404).json({ error: "topilmadi" });
    await db.setBudget(req.userId, req.params.id, null);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---- Budgets ----
app.get("/api/budgets", async (req, res, next) => {
  try {
    res.json(await db.getBudgets(req.userId));
  } catch (err) {
    next(err);
  }
});

app.put("/api/budgets/:categoryId", async (req, res, next) => {
  try {
    res.json(await db.setBudget(req.userId, req.params.categoryId, req.body.limit));
  } catch (err) {
    next(err);
  }
});

// ---- Savings goal ----
app.get("/api/goal", async (req, res, next) => {
  try {
    res.json(await db.getGoal(req.userId));
  } catch (err) {
    next(err);
  }
});

app.put("/api/goal", async (req, res, next) => {
  try {
    res.json(await db.setGoal(req.userId, req.body));
  } catch (err) {
    next(err);
  }
});

// ---- Transactions ----
app.get("/api/transactions", async (req, res, next) => {
  try {
    const { type, category, from, to, q } = req.query;
    let list = await db.listTransactions(req.userId);
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
    const record = await db.addTransaction(req.userId, { type, amount, category, note, date: date || new Date().toISOString() });
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

app.delete("/api/transactions/:id", async (req, res, next) => {
  try {
    const ok = await db.deleteTransaction(req.userId, req.params.id);
    if (!ok) return res.status(404).json({ error: "topilmadi" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.get("/api/summary", async (req, res, next) => {
  try {
    const { period } = req.query;
    const all = await db.listTransactions(req.userId);
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
    const [list, categories] = await Promise.all([db.listTransactions(req.userId), db.listCategories(req.userId)]);
    const nameById = Object.fromEntries(categories.map((c) => [c.id, c.name]));
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = "sana,turi,kategoriya,summa,izoh\n";
    const rows = list
      .map((t) => [t.date, t.type, esc(nameById[t.category] || "Noma'lum"), t.amount, esc(t.note)].join(","))
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
    res.json(await db.listInventory(req.userId, req.query.status));
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

    const item = await db.addInventory(req.userId, {
      productId: productId || null,
      title,
      image: image || null,
      category: category || null,
      quantity: qty,
      purchasePrice: Number(purchasePrice),
      purchasedAt,
    });

    const categories = await db.listCategories(req.userId);
    const expenseCat = categories.find((c) => c.name === "Tovar xaridi" && c.type === "expense") || categories.find((c) => c.type === "expense");
    const tx = await db.addTransaction(req.userId, {
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
    const item = await db.sellInventory(req.userId, req.params.id, Number(salePrice), soldAt);
    if (!item) return res.status(404).json({ error: "topilmadi yoki allaqachon sotilgan" });

    const categories = await db.listCategories(req.userId);
    const incomeCat = categories.find((c) => c.name === "Sotuvdan tushum" && c.type === "income") || categories.find((c) => c.type === "income");
    const tx = await db.addTransaction(req.userId, {
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
    const ok = await db.deleteInventory(req.userId, req.params.id);
    if (!ok) return res.status(404).json({ error: "topilmadi" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Server xatosi" });
});
