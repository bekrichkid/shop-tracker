import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { api, auth } from "./api.js";
import AuthScreen from "./components/AuthScreen.jsx";
import SummaryCards from "./components/SummaryCards.jsx";
import GoalCard from "./components/GoalCard.jsx";
import TransactionForm from "./components/TransactionForm.jsx";
import Filters from "./components/Filters.jsx";
import TransactionList from "./components/TransactionList.jsx";
import ChartsPanel from "./components/ChartsPanel.jsx";
import ProductGrid from "./components/ProductGrid.jsx";
import InventoryList from "./components/InventoryList.jsx";
import CategoryManager from "./components/CategoryManager.jsx";
import ProfileTab from "./components/ProfileTab.jsx";

const emptyFilters = { type: "", category: "", q: "" };

const Icon = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  shop: (
    <>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </>
  ),
  box: (
    <>
      <path d="M21 8 12 3 3 8v8l9 5 9-5z" />
      <path d="m3 8 9 5 9-5M12 13v8" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
};

const TABS = [
  { key: "dashboard", label: "Bosh sahifa", icon: Icon.home },
  { key: "shop", label: "Do'kon", icon: Icon.shop },
  { key: "inventory", label: "Omborim", icon: Icon.box },
  { key: "profile", label: "Profil", icon: Icon.user },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(() => !!auth.getToken());
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("theme") || "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("theme", theme);
    } catch {
      /* storage unavailable */
    }
  }, [theme]);

  const logout = useCallback(() => {
    auth.setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    auth.onUnauthorized(logout);
    if (!auth.getToken()) return;
    api
      .me()
      .then((res) => setUser(res.user))
      .catch(() => auth.setToken(null))
      .finally(() => setBooting(false));
  }, [logout]);

  function handleAuthed(token, u) {
    auth.setToken(token);
    setUser(u);
  }

  if (booting) return <div className="splash">Yuklanmoqda...</div>;
  if (!user) return <AuthScreen onAuthed={handleAuthed} />;
  return <Shop user={user} theme={theme} setTheme={setTheme} onLogout={logout} />;
}

function Shop({ user, theme, setTheme, onLogout }) {
  const [tab, setTab] = useState("dashboard");
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [budgets, setBudgets] = useState({});
  const [goal, setGoal] = useState({});
  const [inventory, setInventory] = useState([]);
  const [period, setPeriod] = useState("month");
  const [filters, setFilters] = useState(emptyFilters);
  const [synced, setSynced] = useState(true);
  const [toast, setToast] = useState(null);
  const [showManager, setShowManager] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

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
    const interval = setInterval(syncAll, 10000);
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
    } else from = new Date(now.getFullYear(), now.getMonth(), 1);
    return transactions.filter((t) => new Date(t.date) >= from);
  }, [transactions, period]);

  const monthTransactions = useMemo(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return transactions.filter((t) => new Date(t.date) >= from);
  }, [transactions]);

  const sum = (list, type) => list.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
  const monthIncome = useMemo(() => sum(monthTransactions, "income"), [monthTransactions]);
  const monthExpense = useMemo(() => sum(monthTransactions, "expense"), [monthTransactions]);
  const income = useMemo(() => sum(periodTransactions, "income"), [periodTransactions]);
  const expense = useMemo(() => sum(periodTransactions, "expense"), [periodTransactions]);
  const inventoryValue = useMemo(() => inventory.reduce((s, i) => s + i.purchasePrice * i.quantity, 0), [inventory]);

  const filteredList = useMemo(
    () =>
      transactions.filter((t) => {
        if (filters.type && t.type !== filters.type) return false;
        if (filters.category && t.category !== filters.category) return false;
        if (filters.q && !(t.note || "").toLowerCase().includes(filters.q.toLowerCase())) return false;
        return true;
      }),
    [transactions, filters]
  );

  const toastTimer = useRef(null);
  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  // Runs an API action, resyncs, and reports failures instead of failing silently.
  async function act(fn, okMessage) {
    try {
      const res = await fn();
      await syncAll();
      if (okMessage) showToast(typeof okMessage === "function" ? okMessage(res) : okMessage);
      return res;
    } catch (err) {
      showToast(err.message || "Xatolik yuz berdi");
      return null;
    }
  }

  const handleAddTransaction = async (data) => {
    const ok = await act(() => api.addTransaction(data), "Yozuv saqlandi");
    if (ok) setShowAdd(false);
  };
  const handleDelete = (id) => act(() => api.deleteTransaction(id));
  const handleSetGoal = (data) => act(() => api.setGoal(data));
  const handleBuy = (data) => act(() => api.buyProduct(data), `"${data.title}" xarid qilindi`);
  const handleSell = (id, price) =>
    act(() => api.sellItem(id, price), (r) => `Sotildi. ${r.profit >= 0 ? "Foyda" : "Zarar"}: ${Math.abs(r.profit).toFixed(2)} $`);
  const handleDeleteInventory = (id) => act(() => api.deleteInventory(id));
  const handleAddCategory = (data) => act(() => api.addCategory(data));
  const handleDeleteCategory = (id) => act(() => api.deleteCategory(id));
  const handleSetBudget = (id, limit) => act(() => api.setBudget(id, limit));

  async function handleExport() {
    try {
      await api.downloadCsv();
    } catch (err) {
      showToast(err.message);
    }
  }

  async function handleDeleteAccount() {
    try {
      await api.deleteAccount();
      onLogout();
    } catch (err) {
      showToast(err.message);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-dot" aria-hidden="true" />
          <h1>Tovar Do'koni</h1>
        </div>
        <nav className="tabs" aria-label="Asosiy menyu">
          {TABS.map((t) => (
            <button key={t.key} className={"tab" + (tab === t.key ? " tab-on" : "")} onClick={() => setTab(t.key)} aria-current={tab === t.key ? "page" : undefined}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {t.icon}
              </svg>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="content">
        {tab === "dashboard" && (
          <div className="stack">
            <SummaryCards period={period} onPeriodChange={setPeriod} income={income} expense={expense} inventoryValue={inventoryValue} synced={synced} />
            <GoalCard goal={goal} monthIncome={monthIncome} monthExpense={monthExpense} onSetGoal={handleSetGoal} />
            <div className="section-head">
              <h2>Tranzaksiyalar</h2>
              <button className="btn btn-small btn-primary" onClick={() => setShowAdd(true)}>+ Yozuv qo'shish</button>
            </div>
            <Filters categories={categories} filters={filters} onChange={setFilters} />
            <TransactionList transactions={filteredList} categoryMap={categoryMap} onDelete={handleDelete} />
            {transactions.length > 0 && (
              <ChartsPanel periodTransactions={periodTransactions} allTransactions={transactions} categoryMap={categoryMap} />
            )}
          </div>
        )}

        {tab === "shop" && <ProductGrid onBuy={handleBuy} />}

        {tab === "inventory" && (
          <div className="stack">
            <div className="section-head">
              <h2>Omborim</h2>
              <span className="muted small">Jami: {inventoryValue.toFixed(2)} $</span>
            </div>
            <InventoryList items={inventory} onSell={handleSell} onDelete={handleDeleteInventory} />
          </div>
        )}

        {tab === "profile" && (
          <ProfileTab
            user={user}
            theme={theme}
            onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")}
            onOpenCategories={() => setShowManager(true)}
            onExport={handleExport}
            onLogout={onLogout}
            onDeleteAccount={handleDeleteAccount}
          />
        )}
      </main>

      {showAdd && (
        <div className="sheet-backdrop" onClick={() => setShowAdd(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Yozuv qo'shish" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grab" />
            <div className="sheet-head">
              <h3>Yozuv qo'shish</h3>
              <button className="icon-btn" onClick={() => setShowAdd(false)} aria-label="Yopish">✕</button>
            </div>
            <TransactionForm categories={categories} onSubmit={handleAddTransaction} />
          </div>
        </div>
      )}

      {showManager && (
        <CategoryManager
          categories={categories}
          budgets={budgets}
          monthTransactions={monthTransactions}
          onSetBudget={handleSetBudget}
          onDeleteCategory={handleDeleteCategory}
          onAddCategory={handleAddCategory}
          onClose={() => setShowManager(false)}
        />
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
