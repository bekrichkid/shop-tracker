import { lazy, Suspense, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { api, auth } from "./api.js";
import AuthScreen from "./components/AuthScreen.jsx";
import SummaryCards from "./components/SummaryCards.jsx";
import GoalCard from "./components/GoalCard.jsx";
import TransactionForm from "./components/TransactionForm.jsx";
import Filters from "./components/Filters.jsx";
import TransactionList from "./components/TransactionList.jsx";
import ProductGrid from "./components/ProductGrid.jsx";
import CategoryManager from "./components/CategoryManager.jsx";
import ProfileTab from "./components/ProfileTab.jsx";
import CartSheet from "./components/CartSheet.jsx";
import ProductSheet from "./components/ProductSheet.jsx";
// Seller-only screens and charts are loaded on demand so customers download a much smaller app.
const admin = (name) => lazy(() => import("./components/AdminViews.jsx").then((m) => ({ default: m[name] })));
const AdminOverview = admin("AdminOverview");
const AdminOrders = admin("AdminOrders");
const AdminProducts = admin("AdminProducts");
const AdminCustomers = admin("AdminCustomers");
const AdminSettingsSheet = admin("AdminSettingsSheet");
const AdminPromosSheet = admin("AdminPromosSheet");
const ChartsPanel = lazy(() => import("./components/ChartsPanel.jsx"));
import OrdersList from "./components/OrdersList.jsx";
import { formatUzs } from "./format.js";
import { useT, tr } from "./i18n.jsx";
import { IS_NATIVE } from "./config.js";

// Up to 3 recent delivery addresses, newest first.
function loadContacts() {
  try {
    const list = JSON.parse(localStorage.getItem("contacts"));
    if (Array.isArray(list) && list.length) return list;
    const old = JSON.parse(localStorage.getItem("contact"));
    return old && old.address ? [old] : [];
  } catch {
    return [];
  }
}
function saveContact(c) {
  if (!c || !c.address) return;
  try {
    const rest = loadContacts().filter((x) => x.address !== c.address);
    localStorage.setItem("contacts", JSON.stringify([c, ...rest].slice(0, 3)));
  } catch {
    /* storage unavailable */
  }
}

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

Icon.chart = (
  <>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </>
);
Icon.wallet = (
  <>
    <path d="M3 7a2 2 0 0 1 2-2h14v4" />
    <path d="M3 7v11a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2" />
    <path d="M16 14h2" />
  </>
);

// Customers only shop and follow their orders; the seller runs the whole business.
const CUSTOMER_TABS = [
  { key: "shop", label: "Do'kon", icon: Icon.shop },
  { key: "orders", label: "Buyurtmalarim", icon: Icon.box },
  { key: "profile", label: "Profil", icon: Icon.user },
];
const ADMIN_TABS = [
  { key: "overview", label: "Umumiy", icon: Icon.chart },
  { key: "orders", label: "Buyurtmalar", icon: Icon.box },
  { key: "products", label: "Tovarlar", icon: Icon.shop },
  { key: "finance", label: "Moliya", icon: Icon.wallet },
  { key: "profile", label: "Profil", icon: Icon.user },
];

export default function App() {
  const [user, setUser] = useState(null);
  // Link from the password-reset email: /?reset=TOKEN
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get("reset"));
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

  if (booting) return <div className="splash">{tr("Yuklanmoqda...")}</div>;
  if (!user) {
    return (
      <AuthScreen
        onAuthed={handleAuthed}
        resetToken={resetToken}
        onResetDone={() => {
          setResetToken(null);
          window.history.replaceState({}, "", window.location.pathname);
        }}
      />
    );
  }
  return <Shop user={user} theme={theme} setTheme={setTheme} onLogout={logout} />;
}

function Shop({ user, theme, setTheme, onLogout }) {
  const tt = useT();
  // One login for everyone. An account listed in ADMIN_EMAILS can also switch between the seller
  // panel and the plain customer view (to try the shop the way customers see it).
  const canAdmin = Boolean(user.isAdmin);
  const modeKey = `mode_${user.id}`;
  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem(modeKey) === "customer" ? "customer" : "admin";
    } catch {
      return "admin";
    }
  });
  const isAdmin = canAdmin && mode === "admin";
  const TABS = isAdmin ? ADMIN_TABS : CUSTOMER_TABS;
  const [tab, setTab] = useState(isAdmin ? "overview" : "shop");
  function switchMode(next) {
    setMode(next);
    setTab(next === "admin" ? "overview" : "shop");
    try {
      localStorage.setItem(modeKey, next);
    } catch {
      /* storage unavailable */
    }
  }
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [budgets, setBudgets] = useState({});
  const [goal, setGoal] = useState({});
  const [period, setPeriod] = useState("month");
  const [filters, setFilters] = useState(emptyFilters);
  const [synced, setSynced] = useState(true);
  const [toast, setToast] = useState(null);
  const [showManager, setShowManager] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPromos, setShowPromos] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [openProduct, setOpenProduct] = useState(null);
  const [store, setStore] = useState(null);
  const [providers, setProviders] = useState([]);
  const favKey = `fav_${user.id}`;
  const [favs, setFavs] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(favKey)) || []);
    } catch {
      return new Set();
    }
  });
  const toggleFav = useCallback(
    (id) =>
      setFavs((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        try {
          localStorage.setItem(favKey, JSON.stringify([...next]));
        } catch {
          /* storage unavailable */
        }
        return next;
      }),
    [favKey]
  );
  const cartKey = `cart_${user.id}`;
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(cartKey)) || [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(cartKey, JSON.stringify(cart));
    } catch {
      /* storage unavailable */
    }
  }, [cart, cartKey]);

  useEffect(() => {
    api.paymentConfig().then((c) => {
      setProviders(c.providers);
    }).catch(() => {});
    api.getStore().then(setStore).catch(() => {});
  }, []);

  // Finance data belongs to the seller only; customers have nothing to sync.
  const syncAll = useCallback(async () => {
    if (!canAdmin) return null;
    try {
      await api.adminSyncLedger();
      const [tx, cats, bud, g] = await Promise.all([api.getTransactions(), api.getCategories(), api.getBudgets(), api.getGoal()]);
      setTransactions(tx);
      setCategories(cats);
      setBudgets(bud);
      setGoal(g);
      setSynced(true);
      return tx;
    } catch {
      setSynced(false);
      return null;
    }
  }, [canAdmin]);

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
    setToast(tr(msg));
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
  const cartQty = useMemo(() => Object.fromEntries(cart.map((i) => [i.productId, i.quantity])), [cart]);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotalUzs = cart.reduce((s, i) => s + i.unitPriceUzs * i.quantity, 0);

  function addToCart(p) {
    setCart((prev) => {
      const found = prev.find((i) => i.productId === p.id);
      if (found) return prev.map((i) => (i.productId === p.id ? { ...i, quantity: Math.min(99, i.quantity + 1) } : i));
      return [...prev, { productId: p.id, title: p.title, image: p.image, category: p.category, unitPriceUzs: p.price, quantity: 1 }];
    });
    showToast("Savatga qo'shildi");
  }
  // The server catalog is the source of truth: refresh cart prices and drop delisted items.
  const syncCartWithCatalog = useCallback((catalog) => {
    const byId = new Map(catalog.map((p) => [p.id, p]));
    setCart((prev) => {
      const next = prev
        .filter((i) => byId.has(i.productId))
        .map((i) => {
          const p = byId.get(i.productId);
          return { ...i, title: p.title, image: p.image, category: p.category, unitPriceUzs: p.price };
        });
      return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
    });
  }, []);
  function reorder(items) {
    setCart((prev) => {
      const next = [...prev];
      for (const it of items) {
        if (it.productId == null) continue;
        const found = next.find((c) => c.productId === it.productId);
        if (found) found.quantity = Math.min(99, found.quantity + it.quantity);
        else next.push({ productId: it.productId, title: it.title, image: it.image, category: "", unitPriceUzs: it.unitPriceUzs, quantity: Math.min(99, it.quantity) });
      }
      return next.map((c) => ({ ...c }));
    });
    setShowCart(true);
  }
  const changeQty = (id, q) =>
    setCart((prev) => (q < 1 ? prev.filter((i) => i.productId !== id) : prev.map((i) => (i.productId === id ? { ...i, quantity: Math.min(99, q) } : i))));
  const removeFromCart = (id) => setCart((prev) => prev.filter((i) => i.productId !== id));

  // Web: leave the page for the provider's checkout. Native app: open it in an in-app browser and
  // confirm the result when the customer comes back (see the listeners below).
  function goToPayment(url, orderId) {
    try {
      localStorage.setItem("pending_order", orderId);
    } catch {
      /* storage unavailable */
    }
    if (IS_NATIVE) {
      import("@capacitor/browser").then(({ Browser }) => Browser.open({ url }));
      return;
    }
    window.location.assign(url);
  }

  async function handlePaid(res) {
    saveContact(res.contact);
    if (res.redirect) return goToPayment(res.redirect, res.orderId);
    setCart([]);
    setShowCart(false);
    setTab("orders");
    showToast("To'lov qabul qilindi. Buyurtmangiz qabul qilindi");
  }

  // Asks the server whether an order got paid (the provider notifies the server, not the browser).
  const confirmPayment = useCallback(async (orderId, isCancelled = () => false) => {
    for (let i = 0; i < 6 && !isCancelled(); i++) {
      try {
        const order = await api.getOrder(orderId);
        if (order.status === "paid") {
          setCart([]);
          setShowCart(false);
          setTab("orders");
          showToast("To'lov qabul qilindi. Buyurtmangiz qabul qilindi");
          return "paid";
        }
        if (order.status === "cancelled") {
          showToast("To'lov bekor qilingan");
          return "cancelled";
        }
      } catch {
        return "error";
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (!isCancelled()) showToast("To'lov tekshirilmoqda. Holatni Buyurtmalarim bo'limida ko'ring");
    return "pending";
  }, [showToast]);

  // Web: returning from the payment page (?order=ID).
  useEffect(() => {
    const orderId = new URLSearchParams(window.location.search).get("order");
    if (!orderId) return undefined;
    let cancelled = false;
    confirmPayment(orderId, () => cancelled).then(() => {
      if (!cancelled) window.history.replaceState({}, "", window.location.pathname);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Native: the in-app browser was closed, or the app came back to the foreground.
  useEffect(() => {
    if (!IS_NATIVE) return undefined;
    const handles = [];
    const check = () => {
      let id = null;
      try {
        id = localStorage.getItem("pending_order");
      } catch {
        /* storage unavailable */
      }
      if (!id) return;
      confirmPayment(id).then((r) => {
        if (r !== "pending") {
          try {
            localStorage.removeItem("pending_order");
          } catch {
            /* storage unavailable */
          }
        }
      });
    };
    import("@capacitor/browser").then(({ Browser }) => Browser.addListener("browserFinished", check).then((h) => handles.push(h)));
    import("@capacitor/app").then(({ App: CapApp }) => CapApp.addListener("appStateChange", (st) => st.isActive && check()).then((h) => handles.push(h)));
    return () => handles.forEach((h) => h.remove());
  }, [confirmPayment]);
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
        {canAdmin && (
          <div className="mode-switch" role="group" aria-label={tt("Ko'rinish rejimi")}>
            <button className={isAdmin ? "on" : ""} onClick={() => switchMode("admin")}>{tt("Sotuvchi")}</button>
            <button className={!isAdmin ? "on" : ""} onClick={() => switchMode("customer")}>{tt("Mijoz")}</button>
          </div>
        )}
        <nav className="tabs" aria-label="Asosiy menyu" style={{ "--n": TABS.length }}>
          {TABS.map((t) => (
            <button key={t.key} className={"tab" + (tab === t.key ? " tab-on" : "")} onClick={() => setTab(t.key)} aria-current={tab === t.key ? "page" : undefined}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {t.icon}
              </svg>
              <span>{tt(t.label)}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="content" key={tab}>
        <Suspense fallback={<div className="muted">{tt("Yuklanmoqda...")}</div>}>
        {tab === "overview" && isAdmin && (
          <div className="stack">
            <AdminOverview onOpenOrders={() => setTab("orders")} />
            <AdminCustomers onToast={showToast} />
          </div>
        )}
        {tab === "orders" && isAdmin && <AdminOrders onToast={showToast} />}
        {tab === "products" && isAdmin && <AdminProducts onToast={showToast} />}

        {tab === "finance" && isAdmin && (
          <div className="stack">
            <SummaryCards period={period} onPeriodChange={setPeriod} income={income} expense={expense} inventoryValue={null} synced={synced} />
            <GoalCard goal={goal} monthIncome={monthIncome} monthExpense={monthExpense} onSetGoal={handleSetGoal} />
            <div className="section-head">
              <h2>Moliya yozuvlari</h2>
              <button className="btn btn-small btn-primary" onClick={() => setShowAdd(true)}>+ Xarajat / daromad</button>
            </div>
            <p className="muted small">Buyurtmalar tushumi va tannarxi avtomatik yoziladi. Ijara, reklama, yetkazib berish kabi boshqa xarajatlarni shu yerga qo'shing.</p>
            <Filters categories={categories} filters={filters} onChange={setFilters} />
            <TransactionList transactions={filteredList} categoryMap={categoryMap} onDelete={handleDelete} />
            {transactions.length > 0 && (
              <ChartsPanel periodTransactions={periodTransactions} allTransactions={transactions} categoryMap={categoryMap} />
            )}
          </div>
        )}

        {tab === "shop" && !isAdmin && <ProductGrid onAddToCart={addToCart} cartQty={cartQty} onCatalog={syncCartWithCatalog} onOpen={setOpenProduct} favs={favs} onToggleFav={toggleFav} />}

        {tab === "orders" && !isAdmin && (
          <OrdersList providers={providers} onRedirect={goToPayment} onChanged={syncAll} onReorder={reorder} onToast={showToast} />
        )}

        {tab === "profile" && (
          <ProfileTab
            store={store}
            user={{ ...user, isAdmin }}
            theme={theme}
            onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")}
            onOpenCategories={() => setShowManager(true)}
            onExport={handleExport}
            onExportOrders={() => api.adminOrdersCsv().catch((e) => showToast(e.message))}
            onOpenSettings={() => setShowSettings(true)}
            onOpenPromos={() => setShowPromos(true)}
            onToast={showToast}
            onLogout={onLogout}
            onDeleteAccount={handleDeleteAccount}
          />
        )}
        </Suspense>
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

      {cartCount > 0 && !showCart && !isAdmin && (
        <button className="cart-bar" onClick={() => setShowCart(true)}>
          <span className="cart-count" key={cartCount}>{cartCount}</span>
          <span>{tt("Savatni ko'rish")}</span>
          <b>{formatUzs(cartTotalUzs)}</b>
        </button>
      )}

      {showCart && (
        <CartSheet
          cart={cart}
          providers={providers}
          savedContacts={loadContacts()}
          onChangeQty={changeQty}
          onRemove={removeFromCart}
          onClose={() => setShowCart(false)}
          onPaid={handlePaid}
        />
      )}

      {openProduct && (
        <ProductSheet product={openProduct} inCart={cartQty[openProduct.id]} onAdd={addToCart} onClose={() => setOpenProduct(null)} fav={favs.has(openProduct.id)} onToggleFav={toggleFav} />
      )}

      <Suspense fallback={null}>
      {showSettings && <AdminSettingsSheet onClose={() => { setShowSettings(false); api.getStore().then(setStore).catch(() => {}); }} onToast={showToast} />}
      {showPromos && <AdminPromosSheet onClose={() => setShowPromos(false)} onToast={showToast} />}
      </Suspense>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
