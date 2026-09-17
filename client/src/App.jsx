import { useEffect, useMemo, useState, useCallback } from "react";
import { api } from "./api.js";
import { API_BASE } from "./config.js";
import SummaryCards from "./components/SummaryCards.jsx";
import GoalCard from "./components/GoalCard.jsx";
import TransactionForm from "./components/TransactionForm.jsx";
import Filters from "./components/Filters.jsx";
import TransactionList from "./components/TransactionList.jsx";
import ChartsPanel from "./components/ChartsPanel.jsx";
import ProductGrid from "./components/ProductGrid.jsx";
import InventoryList from "./components/InventoryList.jsx";

const emptyFilters = { type: "", category: "", from: "", to: "", q: "" };
const TABS = [
  { key: "dashboard", label: "Bosh sahifa" },
  { key: "shop", label: "Do'kon" },
  { key: "inventory", label: "Omborim" },
];

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [budgets, setBudgets] = useState({});
  const [goal, setGoal] = useState({});
  const [inventory, setInventory] = useState([]);
  const [period, setPeriod] = useState("month");
  const [filters, setFilters] = useState(emptyFilters);
  const [synced, setSynced] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const syncAll = useCallback(async () => {
    try {
      const [tx, cats, bud, g, inv] = await Promise.all([
        api.getTransactions(),
        api.getCategories(),
        api.getBudgets(),
        api.getGoal(),
        api.getInventory("holding"),
      ]);
      setTransactions(tx);
      setCategories(cats);
      setBudgets(bud);
      setGoal(g);
      setInventory(inv);
      setSynced(true);
      return tx;
    } catch {
      setSynced(false);
      return null;
    }
  }, []);

  useEffect(() => {
    syncAll();
    const interval = setInterval(syncAll, 8000);
    return () => clearInterval(interval);
  }, [syncAll]);

  const categoryMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const periodTransactions = useMemo(() => {
    if (period === "all") return transactions;
    const now = new Date();
    let from;
    if (period === "today") from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    else if (period === "week") {
      from = new Date(now);
      from.setDate(from.getDate() - 6);
    } else if (period === "month") from = new Date(now.getFullYear(), now.getMonth(), 1);
    return transactions.filter((t) => new Date(t.date) >= from);
  }, [transactions, period]);

  const monthTransactions = useMemo(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return transactions.filter((t) => new Date(t.date) >= from);
  }, [transactions]);

  const monthIncome = useMemo(() => monthTransactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0), [monthTransactions]);
  const monthExpense = useMemo(() => monthTransactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0), [monthTransactions]);

  const income = useMemo(() => periodTransactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0), [periodTransactions]);
  const expense = useMemo(() => periodTransactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0), [periodTransactions]);

  const inventoryValue = useMemo(() => inventory.reduce((s, i) => s + i.purchasePrice * i.quantity, 0), [inventory]);

  const filteredList = useMemo(() => {
    return transactions.filter((t) => {
      if (filters.type && t.type !== filters.type) return false;
      if (filters.category && t.category !== filters.category) return false;
      if (filters.q && !(t.note || "").toLowerCase().includes(filters.q.toLowerCase())) return false;
      return true;
    });
  }, [transactions, filters]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  async function handleAddTransaction(data) {
    await api.addTransaction(data);
    await syncAll();
  }

  async function handleDelete(id) {
    await api.deleteTransaction(id);
    await syncAll();
  }

  async function handleSetGoal(data) {
    await api.setGoal(data);
    await syncAll();
  }

  async function handleBuy(data) {
    await api.buyProduct(data);
    await syncAll();
    showToast(`"${data.title}" xarid qilindi va xarajat sifatida yozildi.`);
  }

  async function handleSell(id, salePrice) {
    const res = await api.sellItem(id, salePrice);
    await syncAll();
    const sign = res.profit >= 0 ? "foyda" : "zarar";
    showToast(`Sotildi. ${sign}: ${Math.abs(res.profit).toFixed(2)}$`);
  }

  async function handleDeleteInventory(id) {
    await api.deleteInventory(id);
    await syncAll();
  }

  function handleExport() {
    window.open(`${API_BASE}/api/export/csv`, "_blank");
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Tovar Do'koni</h1>
        <div className="header-actions">
          <button className="theme-toggle" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
            {theme === "light" ? "🌙" : "☀️"}
          </button>
        </div>
      </header>

      <nav className="tab-nav">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={"tab-btn" + (tab === t.key ? " tab-active" : "")}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "dashboard" && (
        <>
          <SummaryCards period={period} onPeriodChange={setPeriod} income={income} expense={expense} synced={synced} />
          <div className="inventory-value-card">
            <span>Ombordagi tovarlar qiymati</span>
            <b>{new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 2 }).format(inventoryValue)} $</b>
          </div>
          <GoalCard goal={goal} monthIncome={monthIncome} monthExpense={monthExpense} onSetGoal={handleSetGoal} />
          <main className="main-grid">
            <div className="left-col">
              <TransactionForm categories={categories} onSubmit={handleAddTransaction} />
              <ChartsPanel periodTransactions={periodTransactions} allTransactions={transactions} categoryMap={categoryMap} />
            </div>
            <div className="right-col">
              <Filters categories={categories} filters={filters} onChange={setFilters} onExport={handleExport} />
              <TransactionList transactions={filteredList} categoryMap={categoryMap} onDelete={handleDelete} />
            </div>
          </main>
        </>
      )}

      {tab === "shop" && <ProductGrid onBuy={handleBuy} />}

      {tab === "inventory" && (
        <InventoryList items={inventory} onSell={handleSell} onDelete={handleDeleteInventory} />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
