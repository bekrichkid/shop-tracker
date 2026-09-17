import { useState } from "react";
import { formatSum, formatDate } from "../format.js";

export default function InventoryList({ items, onSell, onDelete }) {
  const [selling, setSelling] = useState(null);
  const [price, setPrice] = useState("");

  function startSell(item) {
    setSelling(item);
    setPrice(String(item.purchasePrice * item.quantity));
  }

  async function confirmSell() {
    if (!price || Number(price) <= 0) return;
    await onSell(selling.id, Number(price));
    setSelling(null);
  }

  if (items.length === 0) {
    return <div className="empty-state">Omboringiz bo'sh. "Do'kon" bo'limidan tovar sotib oling.</div>;
  }

  return (
    <>
      <ul className="tx-list inventory-list">
        {items.map((item) => (
          <li key={item.id} className="tx-item">
            <img className="inv-thumb" src={item.image} alt={item.title} />
            <div className="tx-main">
              <div className="tx-top">
                <span className="tx-category">{item.title}</span>
                <span className="tx-amount expense">{formatSum(item.purchasePrice * item.quantity)}</span>
              </div>
              <div className="tx-bottom">
                <span className="tx-date">{formatDate(item.purchasedAt)} · {item.quantity} dona</span>
              </div>
            </div>
            <button className="link-btn small" onClick={() => startSell(item)}>Sotish</button>
            <button className="tx-delete" title="Ombordan olib tashlash" onClick={() => onDelete(item.id)}>✕</button>
          </li>
        ))}
      </ul>

      {selling && (
        <div className="modal-backdrop" onClick={() => setSelling(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Sotish</h3>
              <button className="link-btn" onClick={() => setSelling(null)}>Yopish</button>
            </div>
            <div className="buy-preview">
              <img src={selling.image} alt={selling.title} />
              <div className="buy-title">{selling.title}</div>
            </div>
            <div className="modal-hint">Xarid narxi: {formatSum(selling.purchasePrice * selling.quantity)}</div>
            <label className="field-label">Sotish narxi ($)</label>
            <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            <div className="buy-total">
              Foyda: <span className={Number(price) - selling.purchasePrice * selling.quantity >= 0 ? "insight-good" : "insight-bad"}>
                {formatSum(Number(price || 0) - selling.purchasePrice * selling.quantity)}
              </span>
            </div>
            <button className="submit-btn" onClick={confirmSell}>Tasdiqlash va daromad sifatida yozish</button>
          </div>
        </div>
      )}
    </>
  );
}
