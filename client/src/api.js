import { API_BASE } from "./config.js";
import { tr } from "./i18n.jsx";

const BASE = `${API_BASE}/api`;
const TOKEN_KEY = "shop_token";
let unauthorizedHandler = () => {};

export const auth = {
  getToken: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  setToken: (t) => {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable */
    }
  },
  onUnauthorized: (fn) => {
    unauthorizedHandler = fn;
  },
};

async function request(path, options = {}) {
  const token = auth.getToken();
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401 && !path.startsWith("/auth/login") && !path.startsWith("/auth/register")) {
    unauthorizedHandler();
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(tr(body.error || `So'rov xato: ${res.status}`));
  }
  const contentType = res.headers.get("content-type") || "";
  return contentType.includes("application/json") ? res.json() : res.text();
}

export const api = {
  register: (email, password) => request("/auth/register", { method: "POST", body: JSON.stringify({ email, password }) }),
  login: (email, password) => request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => request("/auth/me"),
  deleteAccount: () => request("/auth/account", { method: "DELETE" }),

  paymentConfig: () => request("/payments/config"),
  createOrder: (data) => request("/orders", { method: "POST", body: JSON.stringify(data) }),
  listOrders: () => request("/orders"),
  getOrder: (id) => request(`/orders/${id}`),
  payOrder: (id, provider) => request(`/orders/${id}/pay`, { method: "POST", body: JSON.stringify({ provider }) }),
  cancelOrder: (id) => request(`/orders/${id}/cancel`, { method: "POST", body: "{}" }),
  // CSV needs the auth header, so it is fetched and saved as a file instead of window.open.
  downloadCsv: async () => {
    const csv = await request("/export/csv");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "tranzaksiyalar.csv";
    a.click();
    URL.revokeObjectURL(url);
  },

  getStore: () => request("/store"),
  getProducts: () => request("/products"),
  adminOrders: (view, q) => request(`/admin/orders?${new URLSearchParams({ ...(view ? { view } : {}), ...(q ? { q } : {}) })}`),
  adminSetOrder: (id, data) => request(`/admin/orders/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  adminStats: () => request("/admin/stats"),
  adminCancelOrder: (id) => request(`/admin/orders/${id}/cancel`, { method: "POST", body: "{}" }),
  adminCustomers: () => request("/admin/customers"),
  adminResetPassword: (id) => request(`/admin/customers/${id}/reset-password`, { method: "POST", body: "{}" }),
  adminPromos: () => request("/admin/promos"),
  adminCreatePromo: (data) => request("/admin/promos", { method: "POST", body: JSON.stringify(data) }),
  adminSetPromoActive: (code, active) => request(`/admin/promos/${code}`, { method: "PUT", body: JSON.stringify({ active }) }),
  adminSettings: () => request("/admin/settings"),
  adminSaveSettings: (data) => request("/admin/settings", { method: "PUT", body: JSON.stringify(data) }),
  adminUploadImage: (id, dataUrl) => request(`/admin/products/${id}/image`, { method: "POST", body: JSON.stringify({ dataUrl }) }),
  adminOrdersCsv: async () => {
    const csv = await request("/admin/orders.csv");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "buyurtmalar.csv";
    a.click();
    URL.revokeObjectURL(url);
  },
  quote: (items, promoCode) => request("/quote", { method: "POST", body: JSON.stringify({ items, promoCode }) }),
  getReviews: (productId) => request(`/products/${productId}/reviews`),
  myReviews: () => request("/reviews/mine"),
  saveReview: (data) => request("/reviews", { method: "POST", body: JSON.stringify(data) }),
  forgot: (email) => request("/auth/forgot", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword: (token, password) => request("/auth/reset", { method: "POST", body: JSON.stringify({ token, password }) }),
  changePassword: (current, next) => request("/auth/change-password", { method: "POST", body: JSON.stringify({ current, next }) }),
  adminSyncLedger: () => request("/admin/sync-ledger", { method: "POST", body: "{}" }),
  adminProducts: () => request("/admin/products"),
  adminCreateProduct: (data) => request("/admin/products", { method: "POST", body: JSON.stringify(data) }),
  adminUpdateProduct: (id, data) => request(`/admin/products/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  getTransactions: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return request(`/transactions${qs ? `?${qs}` : ""}`);
  },
  addTransaction: (data) => request("/transactions", { method: "POST", body: JSON.stringify(data) }),
  deleteTransaction: (id) => request(`/transactions/${id}`, { method: "DELETE" }),

  getCategories: () => request("/categories"),
  addCategory: (data) => request("/categories", { method: "POST", body: JSON.stringify(data) }),
  deleteCategory: (id) => request(`/categories/${id}`, { method: "DELETE" }),

  getBudgets: () => request("/budgets"),
  setBudget: (categoryId, limit) => request(`/budgets/${categoryId}`, { method: "PUT", body: JSON.stringify({ limit }) }),

  getGoal: () => request("/goal"),
  setGoal: (data) => request("/goal", { method: "PUT", body: JSON.stringify(data) }),

  getSummary: (period) => request(`/summary?period=${period}`),

  getInventory: (status) => request(`/inventory${status ? `?status=${status}` : ""}`),
  buyProduct: (data) => request("/inventory/buy", { method: "POST", body: JSON.stringify(data) }),
  sellItem: (id, salePrice) => request(`/inventory/${id}/sell`, { method: "POST", body: JSON.stringify({ salePrice }) }),
  deleteInventory: (id) => request(`/inventory/${id}`, { method: "DELETE" }),
};
