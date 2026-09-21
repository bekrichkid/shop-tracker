import { useState } from "react";
import { formatSum, formatDate } from "../format.js";

export default function InventoryList({ items, onSell, onDelete }) {
  const [selling, setSelling] = useState(null);
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);

  function startSell(item) {
    setSelling(item);
    setPrice(String(item.purchasePrice * item.quantity));
  }

  async function confirmSell() {
    if (busy || !price || Number(price) <= 0) return;
    setBusy(true);
    try {
      await onSell(selling.id, Number(price));
      setSelling(null);
    } finally {
      setBusy(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <p>Omboringiz bo'sh.</p>
        <p className="muted small">"Do'kon" bo'limidan tovar sotib oling.</p>
      </div>
    );
  }

  const cost = selling ? selling.purchasePrice * selling.quantity : 0;
  const profit = Number(price || 0) - cost;

  return (
    <>
      <ul className="list-card">
        {items.map((item) => (
          <li key={item.id} className="row-item">
            <img className="thumb" src={item.image} alt="" />
            <div className="row-main">
              <div className="row-title">{item.title}</div>
              <div className="row-sub">{formatDate(item.purchasedAt)} · {item.quantity} dona · {formatSum(item.purchasePrice * item.quantity)}</div>
            </div>
            <div className="row-actions">
              <button className="btn btn-small btn-primary" onClick={() => startSell(item)}>Sotish</button>
              <button className="icon-btn" title="Ombordan olib tashlash" aria-label="Ombordan olib tashlash" onClick={() => onDelete(item.id)}>✕</button>
            </div>
          </li>
        ))}
      </ul>

      {selling && (
        <div className="sheet-backdrop" onClick={() => setSelling(null)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Sotish" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grab" />
            <div className="sheet-head">
              <h3>Sotish</h3>
              <button className="icon-btn" onClick={() => setSelling(null)} aria-label="Yopish">✕</button>
            </div>
            <div className="buy-preview">
              <img src={selling.image} alt="" />
              <div className="buy-title">{selling.title}</div>
            </div>
            <div className="muted small">Xarid narxi: {formatSum(cost)}</div>
            <label className="field">
              <span>Sotish narxi ($)</span>
              <input type="number" inputMode="decimal" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </label>
            <div className="total-row">
              <span>{profit >= 0 ? "Foyda" : "Zarar"}</span>
              <b className={profit >= 0 ? "pos" : "neg"}>{formatSum(Math.abs(profit))}</b>
            </div>
            <button className="btn btn-primary btn-block" onClick={confirmSell} disabled={busy}>
              {busy ? "Iltimos kuting..." : "Tasdiqlash"}
            </button>
            <p className="muted small center">Daromad sifatida yoziladi.</p>
          </div>
        </div>
      )}
    </>
  );
}
