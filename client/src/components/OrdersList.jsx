import { useEffect, useState } from "react";
import { api } from "../api.js";
import { formatUzs, formatDate } from "../format.js";
import { useT } from "../i18n.jsx";

const STEPS = [
  { key: "new", label: "To'landi" },
  { key: "processing", label: "Tayyorlanmoqda" },
  { key: "shipped", label: "Yo'lda" },
  { key: "delivered", label: "Yetkazildi" },
];

function Timeline({ fulfillment }) {
  const t = useT();
  const at = Math.max(0, STEPS.findIndex((x) => x.key === fulfillment));
  return (
    <ol className="timeline" aria-label={t("Buyurtma holati")}>
      {STEPS.map((st, i) => (
        <li key={st.key} className={i < at ? "done" : i === at ? "now" : ""}>
          <span className="tl-dot" />
          <span className="tl-label">{t(st.label)}</span>
        </li>
      ))}
    </ol>
  );
}

const STATUS = { pending: ["To'lov kutilmoqda", "st-pending"], paid: ["To'langan", "st-paid"], cancelled: ["Bekor qilingan", "st-cancelled"] };

function ReviewSheet({ item, onClose, onSaved }) {
  const t = useT();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.saveReview({ productId: item.productId, rating, comment });
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet" role="dialog" aria-modal="true" aria-label={t("Tovarni baholash")} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="sheet-grab" />
        <div className="sheet-head"><h3>{t("Tovarni baholash")}</h3><button type="button" className="icon-btn" onClick={onClose} aria-label={t("Yopish")}>✕</button></div>
        <div className="row-title">{item.title}</div>
        <div className="stars" role="radiogroup" aria-label={t("Baho")}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button type="button" key={n} role="radio" aria-checked={rating === n} className={n <= rating ? "on" : ""} onClick={() => setRating(n)}>★</button>
          ))}
        </div>
        <label className="field">
          <span>{t("Fikringiz (ixtiyoriy)")}</span>
          <textarea rows="3" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
        </label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>{t("Yuborish")}</button>
      </form>
    </div>
  );
}

export default function OrdersList({ providers, onRedirect, onChanged, onReorder, onToast }) {
  const t = useT();
  const [orders, setOrders] = useState(null);
  const [reviewed, setReviewed] = useState([]);
  const [reviewing, setReviewing] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = () => {
    api.myReviews().then(setReviewed).catch(() => {});
    return api.listOrders().then(setOrders).catch((e) => setError(e.message));
  };
  useEffect(() => {
    load();
    const timer = setInterval(load, 15000); // pick up status changes made by the shop
    return () => clearInterval(timer);
  }, []);

  async function pay(order) {
    setBusyId(order.id);
    setError("");
    try {
      const provider = order.provider && providers.includes(order.provider) ? order.provider : providers[0];
      const res = await api.payOrder(order.id, provider);
      if (res.payUrl) onRedirect(res.payUrl, order.id);
      else {
        await load();
        onChanged();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId("");
    }
  }

  async function cancel(order) {
    setBusyId(order.id);
    try {
      await api.cancelOrder(order.id);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="stack">
      <div className="section-head">
        <h2>{t("Buyurtmalarim")}</h2>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {orders === null && !error && <div className="muted">{t("Yuklanmoqda...")}</div>}
      {orders && orders.length === 0 && <div className="empty-state">{t("Hozircha buyurtmalar yo'q.")}</div>}
      {orders && orders.map((o) => {
        const [label, cls] = STATUS[o.status];
        return (
          <div key={o.id} className="order-card">
            <div className="order-top">
              <span className={"badge " + cls}>{t(label)}</span>
              <span className="muted small">#{o.id} · {formatDate(o.createdAt)}</span>
            </div>
            <ul className="order-items">
              {o.items.map((i, idx) => (
                <li key={idx} className="order-item-row">
                  <span>{i.quantity} × {i.title}</span>
                  {o.status === "paid" && o.fulfillment === "delivered" && i.productId != null && !reviewed.includes(i.productId) && (
                    <button className="link-btn small" onClick={() => setReviewing(i)}>★ {t("Baholash")}</button>
                  )}
                </li>
              ))}
            </ul>
            {(o.discountUzs > 0 || o.deliveryUzs > 0) && (
              <div className="muted small">
                {o.discountUzs > 0 && <>{t("Chegirma")}: −{formatUzs(o.discountUzs)}. </>}
                {o.deliveryUzs > 0 && <>{t("Yetkazib berish")}: {formatUzs(o.deliveryUzs)}</>}
              </div>
            )}
            <div className="order-foot">
              <b>{formatUzs(o.totalUzs)}</b>
            </div>
            {o.status === "paid" && <Timeline fulfillment={o.fulfillment} />}
            {o.status === "paid" && o.adminNote && <div className="note-box">{o.adminNote}</div>}
            {o.status === "paid" && (
              <div className="order-actions">
                <button className="btn btn-small btn-ghost" onClick={() => onReorder(o.items)}>{t("Qayta buyurtma")}</button>
              </div>
            )}
            {o.status === "pending" && (
              <div className="order-actions">
                <button className="btn btn-small btn-primary" disabled={busyId === o.id} onClick={() => pay(o)}>{t("To'lash")}</button>
                <button className="btn btn-small btn-ghost" disabled={busyId === o.id} onClick={() => cancel(o)}>{t("Bekor qilish")}</button>
              </div>
            )}
          </div>
        );
      })}
      {reviewing && (
        <ReviewSheet
          item={reviewing}
          onClose={() => setReviewing(null)}
          onSaved={() => {
            setReviewing(null);
            onToast(t("Rahmat! Fikringiz saqlandi"));
            load();
          }}
        />
      )}
    </div>
  );
}
