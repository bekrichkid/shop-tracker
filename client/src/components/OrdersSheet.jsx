import { useEffect, useState } from "react";
import { api } from "../api.js";
import { formatSum, formatUzs, formatDate } from "../format.js";

const STATUS = { pending: ["To'lov kutilmoqda", "st-pending"], paid: ["To'langan", "st-paid"], cancelled: ["Bekor qilingan", "st-cancelled"] };

export default function OrdersSheet({ providers, onClose, onRedirect, onChanged }) {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = () => api.listOrders().then(setOrders).catch((e) => setError(e.message));
  useEffect(() => {
    load();
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
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Buyurtmalarim" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" />
        <div className="sheet-head">
          <h3>Buyurtmalarim</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Yopish">✕</button>
        </div>
        {error && <div className="form-error" role="alert">{error}</div>}
        {orders === null && !error && <div className="muted">Yuklanmoqda...</div>}
        {orders && orders.length === 0 && <div className="empty-state">Hozircha buyurtmalar yo'q.</div>}
        {orders && orders.map((o) => {
          const [label, cls] = STATUS[o.status];
          return (
            <div key={o.id} className="order-card">
              <div className="order-top">
                <span className={"badge " + cls}>{label}</span>
                <span className="muted small">{formatDate(o.createdAt)}</span>
              </div>
              <ul className="order-items">
                {o.items.map((i, idx) => (
                  <li key={idx}>{i.quantity} × {i.title}</li>
                ))}
              </ul>
              <div className="order-foot">
                <b>{formatUzs(o.totalUzs)}</b>
                <span className="muted small">{formatSum(o.totalUsd)}</span>
              </div>
              {o.status === "pending" && (
                <div className="order-actions">
                  <button className="btn btn-small btn-primary" disabled={busyId === o.id} onClick={() => pay(o)}>To'lash</button>
                  <button className="btn btn-small btn-ghost" disabled={busyId === o.id} onClick={() => cancel(o)}>Bekor qilish</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
