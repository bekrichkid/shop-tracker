import { formatSum } from "../format.js";

export default function ProductSheet({ product: p, inCart, rate, onAdd, onClose }) {
  const out = p.stock !== null && p.stock !== undefined && p.stock <= 0;
  const low = !out && p.stock !== null && p.stock !== undefined && p.stock <= 5;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={p.title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" />
        <div className="sheet-head">
          <span className="chip chip-static">{p.category}</span>
          <button className="icon-btn" onClick={onClose} aria-label="Yopish">✕</button>
        </div>
        <div className="detail-image"><img src={p.image} alt={p.title} /></div>
        <h3 className="detail-title">{p.title}</h3>
        <div className="detail-meta">
          <b className="detail-price">{formatSum(p.price)}</b>
          {rate ? <span className="muted">≈ {Math.round(p.price * rate).toLocaleString("en-US")} so'm</span> : null}
          {p.rating && <span className="product-rating">★ {p.rating.rate} ({p.rating.count})</span>}
        </div>
        {low && <div className="stock-note">Oxirgi {p.stock} dona qoldi</div>}
        {p.description && <p className="detail-desc">{p.description}</p>}
        <button className="btn btn-primary btn-block" disabled={out} onClick={() => onAdd(p)}>
          {out ? "Tugagan" : inCart ? `Savatda: ${inCart} · yana qo'shish` : "Savatga qo'shish"}
        </button>
      </div>
    </div>
  );
}
