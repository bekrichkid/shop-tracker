import { API_BASE } from "./config.js";

const BASE = `${API_BASE}/api`;

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `So'rov xato: ${res.status}`);
  }
  const contentType = res.headers.get("content-type") || "";
  return contentType.includes("application/json") ? res.json() : res.text();
}

export const api = {
  getProducts: (category) => request(`/products${category ? `?category=${encodeURIComponent(category)}` : ""}`),
  getProductCategories: () => request("/products/categories"),

  getTransactions: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return request(`/transactions${qs ? `?${qs}` : ""}`);
  },
  addTransaction: (data) => request("/transactions", { method: "POST", body: JSON.stringify(data) }),
  deleteTransaction: (id) => request(`/transactions/${id}`, { method: "DELETE" }),

  getCategories: () => request("/categories"),
  addCategory: (data) => request("/categories", { method: "POST", body: JSON.stringify(data) }),

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
