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
      <div>
        <h4 className="admin-h">Oxirgi 14 kun tushumi</h4>
        <div className="bars" role="img" aria-label="Kunlik tushum">
          {(() => {
            const max = Math.max(1, ...s.daily.map((d) => d.uzs));
            return s.daily.map((d) => (
              <div key={d.date} className="bar-col" title={`${d.date}: ${formatUzs(d.uzs)} (${d.orders})`}>
                <div className="bar" style={{ height: `${Math.max(3, (d.uzs / max) * 100)}%`, opacity: d.uzs ? 1 : 0.25 }} />
                <span>{d.date.slice(8)}</span>
              </div>
            ));
          })()}
        </div>
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

export function AdminCustomers({ onToast }) {
  const [list, setList] = useState(null);
  const [temp, setTemp] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api.adminCustomers().then(setList).catch((e) => setError(e.message));
  }, []);
  async function reset(c) {
    if (!window.confirm(`${c.email} uchun vaqtinchalik parol yaratilsinmi? Eski parol ishlamay qoladi.`)) return;
    try {
      setTemp(await api.adminResetPassword(c.id));
    } catch (e) {
      onToast(e.message);
    }
  }
  if (error) return <div className="form-error">{error}</div>;
  if (!list) return <div className="muted">Yuklanmoqda...</div>;
  return (
    <div>
      <h4 className="admin-h">Mijozlar ({list.length})</h4>
      {temp && (
        <div className="form-info" role="status">
          {temp.email} uchun vaqtinchalik parol: <b className="mono">{temp.tempPassword}</b>. Mijozga yetkazing, u kirgach Profil → Parolni o'zgartirish orqali o'zgartiradi.
        </div>
      )}
      <ul className="list-card">
        {list.map((c) => (
          <li key={c.id} className="row-item">
            <div className="row-main">
              <div className="row-title">{c.email}</div>
              <div className="row-sub">{c.orders} ta buyurtma · {formatUzs(c.spent)}</div>
            </div>
            <button className="btn btn-small btn-ghost" onClick={() => reset(c)}>Parolni tiklash</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminOrders({ onToast }) {
  const [view, setView] = useState("new");
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const [q, setQ] = useState("");
  const load = useCallback(() => {
    setError("");
    return api.adminOrders(q ? "" : view, q).then(setOrders).catch((e) => setError(e.message));
  }, [view, q]);
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
  async function cancelOrder(o) {
    if (!window.confirm(`#${o.id} buyurtmani bekor qilaymi? Tovar zaxiraga qaytadi. Pulni Payme/Click kabinetidan qaytarishingiz kerak.`)) return;
    setBusy(o.id);
    try {
      await api.adminCancelOrder(o.id);
      onToast("Buyurtma bekor qilindi");
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
      <input className="note-input" type="search" placeholder="Qidirish: ism, telefon, email yoki #raqam" value={q} onChange={(e) => setQ(e.target.value)} />
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
          {(o.discountUzs > 0 || o.deliveryUzs > 0) && (
            <div className="muted small">
              {o.discountUzs > 0 && <>Promokod {o.promoCode}: −{formatUzs(o.discountUzs)}. </>}
              {o.deliveryUzs > 0 && <>Yetkazish: {formatUzs(o.deliveryUzs)}</>}
            </div>
          )}
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
              {(o.fulfillment === "new" || o.fulfillment === "processing") && (
                <button className="btn btn-small btn-ghost" disabled={busy === o.id} onClick={() => cancelOrder(o)}>Bekor qilish (qaytarish)</button>
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

// Shrinks a photo in the browser (max 900px, JPEG) so uploads stay small and fast.
function resizeImage(file, max = 900) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = url;
  });
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
    setPhoto(null);
    setEdit(p);
    setForm(p === "new" ? emptyForm : {
      title: p.title, category: p.category, price: String(p.price), cost: p.cost === null || p.cost === undefined ? "" : String(p.cost), image: p.image || "",
      stock: p.stock === null || p.stock === undefined ? "" : String(p.stock), description: p.description || "",
    });
  }

  const [photo, setPhoto] = useState(null); // resized data URL waiting to be uploaded

  async function pickPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setPhoto(await resizeImage(file));
    } catch {
      setError("Rasmni o'qib bo'lmadi");
    }
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = {
      title: form.title, category: form.category, price: Number(form.price), cost: form.cost === "" ? null : Number(form.cost), description: form.description,
      stock: form.stock === "" ? null : Number(form.stock),
    };
    try {
      const saved = edit === "new" ? await api.adminCreateProduct(body) : await api.adminUpdateProduct(edit.id, body);
      if (photo) await api.adminUploadImage(saved.id, photo);
      onToast("Saqlandi");
      setPhoto(null);
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
        <label className="field"><span>Narx (so'm)</span><input required type="number" step="1" min="100" inputMode="numeric" value={form.price} onChange={set("price")} /></label>
        <label className="field"><span>Tannarx (so'm, foyda hisoblash uchun)</span><input type="number" step="1" min="0" inputMode="numeric" value={form.cost} onChange={set("cost")} /></label>
        <label className="field"><span>Zaxira (bo'sh = cheksiz)</span><input type="number" min="0" step="1" inputMode="numeric" value={form.stock} onChange={set("stock")} /></label>
        <div className="field">
          <span>Rasm</span>
          <div className="photo-pick">
            {(photo || form.image) && <img className="thumb" src={photo || form.image} alt="" />}
            <label className="btn btn-small btn-ghost">
              {photo || form.image ? "Rasmni almashtirish" : "Rasm tanlash"}
              <input type="file" accept="image/*" hidden onChange={pickPhoto} />
            </label>
          </div>
        </div>
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

export function AdminSettingsSheet({ onClose, onToast }) {
  const [f, setF] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api.adminSettings().then((c) => setF({ ...c, deliveryFee: String(c.deliveryFee), freeDeliveryFrom: String(c.freeDeliveryFrom) })).catch((e) => setError(e.message));
  }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function save(e) {
    e.preventDefault();
    try {
      await api.adminSaveSettings({ ...f, deliveryFee: Number(f.deliveryFee) || 0, freeDeliveryFrom: Number(f.freeDeliveryFrom) || 0 });
      onToast("Sozlamalar saqlandi");
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet" role="dialog" aria-modal="true" aria-label="Sozlamalar" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <div className="sheet-grab" />
        <div className="sheet-head"><h3>Do'kon sozlamalari</h3><button type="button" className="icon-btn" onClick={onClose} aria-label="Yopish">✕</button></div>
        {error && <div className="form-error">{error}</div>}
        {!f ? <div className="muted">Yuklanmoqda...</div> : (
          <>
            <label className="field"><span>Do'kon nomi</span><input value={f.name} onChange={set("name")} /></label>
            <label className="field"><span>Telefon (mijozlar qo'ng'iroq qiladi)</span><input value={f.phone} onChange={set("phone")} placeholder="+998 90 123 45 67" /></label>
            <label className="field"><span>Telegram (@nom yoki havola)</span><input value={f.telegram} onChange={set("telegram")} /></label>
            <label className="field"><span>Ish vaqti</span><input value={f.hours} onChange={set("hours")} placeholder="09:00–21:00" /></label>
            <label className="field"><span>Yetkazib berish narxi (so'm, 0 = bepul)</span><input type="number" min="0" step="1000" inputMode="numeric" value={f.deliveryFee} onChange={set("deliveryFee")} /></label>
            <label className="field"><span>Shu summadan yuqori buyurtmada yetkazish bepul (0 = yo'q)</span><input type="number" min="0" step="1000" inputMode="numeric" value={f.freeDeliveryFrom} onChange={set("freeDeliveryFrom")} /></label>
            <button className="btn btn-primary btn-block">Saqlash</button>
          </>
        )}
      </form>
    </div>
  );
}

export function AdminPromosSheet({ onClose, onToast }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [f, setF] = useState({ code: "", kind: "percent", value: "", minTotal: "", maxUses: "", days: "" });
  const load = () => api.adminPromos().then(setList).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function create(e) {
    e.preventDefault();
    setError("");
    try {
      await api.adminCreatePromo({ ...f, value: Number(f.value) });
      onToast("Promokod yaratildi");
      setF({ code: "", kind: "percent", value: "", minTotal: "", maxUses: "", days: "" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function toggle(p) {
    await api.adminSetPromoActive(p.code, !p.active);
    load();
  }
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Promokodlar" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" />
        <div className="sheet-head"><h3>Promokodlar</h3><button type="button" className="icon-btn" onClick={onClose} aria-label="Yopish">✕</button></div>
        <form className="stack" onSubmit={create}>
          <div className="promo-grid">
            <input required placeholder="KOD (masalan: YANGI10)" value={f.code} onChange={set("code")} maxLength={20} />
            <select value={f.kind} onChange={set("kind")}><option value="percent">Foiz (%)</option><option value="amount">Summa (so'm)</option></select>
            <input required type="number" min="1" placeholder={f.kind === "percent" ? "Foiz (1–100)" : "Chegirma summasi"} value={f.value} onChange={set("value")} />
            <input type="number" min="0" placeholder="Minimal buyurtma (so'm)" value={f.minTotal} onChange={set("minTotal")} />
            <input type="number" min="1" placeholder="Necha marta ishlatiladi" value={f.maxUses} onChange={set("maxUses")} />
            <input type="number" min="1" placeholder="Necha kun amal qiladi" value={f.days} onChange={set("days")} />
          </div>
          {error && <div className="form-error">{error}</div>}
          <button className="btn btn-primary">+ Promokod yaratish</button>
        </form>
        {list && list.length > 0 && (
          <ul className="list-card">
            {list.map((p) => (
              <li key={p.code} className={"row-item" + (p.active ? "" : " row-off")}>
                <div className="row-main">
                  <div className="row-title mono">{p.code}</div>
                  <div className="row-sub">{p.kind === "percent" ? `${p.value}%` : formatUzs(p.value)} · ishlatilgan {p.used}{p.maxUses ? `/${p.maxUses}` : ""}{p.minTotal ? ` · min ${formatUzs(p.minTotal)}` : ""}{p.expiresAt ? ` · ${formatDate(p.expiresAt)} gacha` : ""}</div>
                </div>
                <button className="btn btn-small btn-ghost" onClick={() => toggle(p)}>{p.active ? "O'chirish" : "Yoqish"}</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
