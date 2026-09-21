import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { formatSum, formatUzs, formatDate } from "../format.js";

const VIEWS = [
  { key: "new", label: "Yangi" },
  { key: "processing", label: "Tayyorlanmoqda" },
  { key: "shipped", label: "Yo'lda" },
  { key: "delivered", label: "Yetkazildi" },
  { key: "unpaid", label: "To'lanmagan" },
  { key: "cancelled", label: "Bekor" },
];

const NEXT = {
  new: { to: "processing", label: "Tayyorlashni boshlash" },
  processing: { to: "shipped", label: "Yo'lga chiqarish" },
  shipped: { to: "delivered", label: "Yetkazildi deb belgilash" },
};

export function AdminOverview({ onOpenOrders }) {
  const [s, setS] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api.adminStats().then(setS).catch((e) => setError(e.message));
  }, []);
  if (error) return <div className="form-error">{error}</div>;
  if (!s) return <div className="muted">Yuklanmoqda...</div>;
  const active = (s.byStatus.new || 0) + (s.byStatus.processing || 0) + (s.byStatus.shipped || 0);
  return (
    <div className="stack">
      {(s.byStatus.new || 0) > 0 && (
        <button className="admin-entry" onClick={onOpenOrders}>
          <span>
            <b>{s.byStatus.new} ta yangi buyurtma kutmoqda</b>
            <span className="muted small">Ko'rib chiqish uchun bosing</span>
          </span>
          <span className="chev">›</span>
        </button>
      )}
      <div className="stat-grid">
        {[["Bugun", s.today], ["7 kun", s.week], ["30 kun", s.month], ["Jami", s.all]].map(([label, v]) => (
          <div className="stat" key={label}>
            <span className="muted small">{label}</span>
            <b>{formatUzs(v.uzs)}</b>
            <span className="small muted">{v.orders} ta buyurtma</span>
            <span className={"small " + (v.profit >= 0 ? "pos" : "neg")}>Foyda: {formatUzs(v.profit)}</span>
          </div>
        ))}
      </div>
      <div className="stat-grid">
        <div className="stat"><span className="muted small">Bajarilishi kerak</span><b>{active}</b></div>
        <div className="stat"><span className="muted small">Mijozlar</span><b>{s.customers}</b></div>
      </div>
      {s.lowStock.length > 0 && (
        <div>
          <h4 className="admin-h">Zaxira tugayapti</h4>
          <ul className="list-card">
            {s.lowStock.map((p) => (
              <li key={p.id} className="row-item"><div className="row-main"><div className="row-title">{p.title}</div></div><b className={p.stock === 0 ? "neg" : ""}>{p.stock} dona</b></li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <h4 className="admin-h">Eng ko'p sotilgan</h4>
        {s.top.length === 0 ? <div className="muted small">Hali sotuvlar yo'q.</div> : (
          <ul className="list-card">
            {s.top.map((t, i) => (
              <li key={i} className="row-item">
                <img className="thumb" src={t.image} alt="" />
                <div className="row-main"><div className="row-title">{t.title}</div><div className="row-sub">{t.qty} dona · {formatUzs(t.uzs)}</div></div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function AdminOrders({ onToast }) {
  const [view, setView] = useState("new");
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    setError("");
    return api.adminOrders(view).then(setOrders).catch((e) => setError(e.message));
  }, [view]);
  useEffect(() => {
    setOrders(null);
    load();
  }, [load]);

  async function advance(o, to) {
    setBusy(o.id);
    try {
      await api.adminSetOrder(o.id, { fulfillment: to });
      onToast("Holat yangilandi");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  async function saveNote(o, note) {
    try {
      await api.adminSetOrder(o.id, { note });
      onToast("Izoh saqlandi");
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="stack">
      <div className="chip-row">
        {VIEWS.map((v) => (
          <button key={v.key} className={"chip" + (view === v.key ? " chip-active" : "")} onClick={() => setView(v.key)}>{v.label}</button>
        ))}
        <button className="chip" onClick={load} aria-label="Yangilash">↻</button>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {orders === null && !error && <div className="muted">Yuklanmoqda...</div>}
      {orders && orders.length === 0 && <div className="empty-state small">Bu bo'limda buyurtma yo'q.</div>}
      {orders && orders.map((o) => (
        <div key={o.id} className="order-card">
          <div className="order-top">
            <b>#{o.id}</b>
            <span className="muted small">{formatDate(o.createdAt)}</span>
          </div>
          <div className="cust">
            <div><b>{o.fullName}</b> <span className="muted small">{o.customerEmail}</span></div>
            <a href={`tel:${(o.phone || "").replace(/\s/g, "")}`}>{o.phone}</a>
            <div className="muted small">{o.address}</div>
          </div>
          <ul className="order-items">
            {o.items.map((i, idx) => <li key={idx}>{i.quantity} × {i.title}</li>)}
          </ul>
          <div className="order-foot">
            <b>{formatUzs(o.totalUzs)}</b>
            <span className="muted small">{o.provider ? o.provider : ""}{o.status === "pending" ? "to'lov kutilmoqda" : ""}</span>
          </div>
          {o.status === "paid" && (
            <>
              <NoteField key={o.id + (o.adminNote || "")} initial={o.adminNote} onSave={(n) => saveNote(o, n)} />
              {NEXT[o.fulfillment] && (
                <button className="btn btn-primary btn-block" disabled={busy === o.id} onClick={() => advance(o, NEXT[o.fulfillment].to)}>
                  {NEXT[o.fulfillment].label}
                </button>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function NoteField({ initial, onSave }) {
  const [v, setV] = useState(initial || "");
  return (
    <input
      className="note-input"
      placeholder="Izoh (mijozga ko'rinadi: kuryer, vaqt...)"
      value={v}
      maxLength={500}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== (initial || "") && onSave(v)}
    />
  );
}

const emptyForm = { title: "", category: "", price: "", cost: "", image: "", stock: "", description: "" };

export function AdminProducts({ onToast }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [edit, setEdit] = useState(null); // null | "new" | product
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.adminProducts().then(setList).catch((e) => setError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  function open(p) {
    setError("");
    setEdit(p);
    setForm(p === "new" ? emptyForm : {
      title: p.title, category: p.category, price: String(p.price), cost: p.cost === null || p.cost === undefined ? "" : String(p.cost), image: p.image || "",
      stock: p.stock === null || p.stock === undefined ? "" : String(p.stock), description: p.description || "",
    });
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = {
      title: form.title, category: form.category, price: Number(form.price), cost: form.cost === "" ? null : Number(form.cost), image: form.image, description: form.description,
      stock: form.stock === "" ? null : Number(form.stock),
    };
    try {
      if (edit === "new") await api.adminCreateProduct(body);
      else await api.adminUpdateProduct(edit.id, body);
      onToast("Saqlandi");
      setEdit(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(p) {
    try {
      await api.adminUpdateProduct(p.id, { active: !p.active });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (edit) {
    return (
      <form className="stack" onSubmit={save}>
        <div className="section-head">
          <h3>{edit === "new" ? "Yangi tovar" : "Tovarni tahrirlash"}</h3>
          <button type="button" className="icon-btn" onClick={() => setEdit(null)} aria-label="Yopish">✕</button>
        </div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <label className="field"><span>Nomi</span><input required value={form.title} onChange={set("title")} /></label>
        <label className="field"><span>Kategoriya</span><input required value={form.category} onChange={set("category")} placeholder="masalan: kiyim" /></label>
        <label className="field"><span>Narx (USD)</span><input required type="number" step="0.01" min="0.01" inputMode="decimal" value={form.price} onChange={set("price")} /></label>
        <label className="field"><span>Tannarx (USD, foyda hisoblash uchun)</span><input type="number" step="0.01" min="0" inputMode="decimal" value={form.cost} onChange={set("cost")} /></label>
        <label className="field"><span>Zaxira (bo'sh = cheksiz)</span><input type="number" min="0" step="1" inputMode="numeric" value={form.stock} onChange={set("stock")} /></label>
        <label className="field"><span>Rasm manzili (URL yoki /products/x.png)</span><input value={form.image} onChange={set("image")} /></label>
        <label className="field"><span>Tavsif</span><textarea rows="3" value={form.description} onChange={set("description")} /></label>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Saqlanmoqda..." : "Saqlash"}</button>
      </form>
    );
  }

  return (
    <div className="stack">
      <button className="btn btn-primary" onClick={() => open("new")}>+ Yangi tovar</button>
      {error && <div className="form-error" role="alert">{error}</div>}
      {list === null && !error && <div className="muted">Yuklanmoqda...</div>}
      {list && (
        <ul className="list-card">
          {list.map((p) => (
            <li key={p.id} className={"row-item" + (p.active ? "" : " row-off")}>
              <img className="thumb" src={p.image} alt="" />
              <div className="row-main">
                <div className="row-title">{p.title}</div>
                <div className="row-sub">{formatSum(p.price)}{p.cost != null ? ` (tannarx ${formatSum(p.cost)})` : ""} · {p.stock === null || p.stock === undefined ? "zaxira cheksiz" : `${p.stock} dona`}{p.active ? "" : " · yashirin"}</div>
              </div>
              <div className="row-actions">
                <button className="btn btn-small btn-ghost" onClick={() => open(p)}>Tahrir</button>
                <button className="btn btn-small btn-ghost" onClick={() => toggle(p)}>{p.active ? "Yashirish" : "Ko'rsatish"}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
