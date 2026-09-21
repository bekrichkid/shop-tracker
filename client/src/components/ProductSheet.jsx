import { useEffect, useState } from "react";
import { api } from "../api.js";
import { formatSum, formatDate } from "../format.js";
import { useT } from "../i18n.jsx";

const Stars = ({ n }) => <span className="star-line" aria-label={`${n}/5`}>{"★".repeat(n)}<span className="off">{"★".repeat(5 - n)}</span></span>;

export default function ProductSheet({ product: p, inCart, onAdd, onClose, fav, onToggleFav }) {
  const t = useT();
  const [reviews, setReviews] = useState(null);
  useEffect(() => {
    api.getReviews(p.id).then(setReviews).catch(() => setReviews([]));
  }, [p.id]);

  const out = p.stock !== null && p.stock !== undefined && p.stock <= 0;
  const low = !out && p.stock !== null && p.stock !== undefined && p.stock <= 5;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={p.title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" />
        <div className="sheet-head">
          <span className="chip chip-static">{p.category}</span>
          <div className="head-actions">
            <button className={"icon-btn heart" + (fav ? " on" : "")} onClick={() => onToggleFav(p.id)} aria-pressed={fav} aria-label={t("Sevimlilar")}>{fav ? "♥" : "♡"}</button>
            <button className="icon-btn" onClick={onClose} aria-label={t("Yopish")}>✕</button>
          </div>
        </div>
        <div className="detail-image"><img src={p.image} alt={p.title} /></div>
        <h3 className="detail-title">{p.title}</h3>
        <div className="detail-meta">
          <b className="detail-price">{formatSum(p.price)}</b>
          {p.rating && <span className="product-rating">★ {p.rating.rate} ({p.rating.count})</span>}
        </div>
        {low && <div className="stock-note">{t("Oxirgi {n} dona qoldi", { n: p.stock })}</div>}
        {p.description && <p className="detail-desc">{p.description}</p>}
        <button className="btn btn-primary btn-block" disabled={out} onClick={() => onAdd(p)}>
          {out ? t("Tugagan") : inCart ? t("Savatda: {n} · yana qo'shish", { n: inCart }) : t("Savatga qo'shish")}
        </button>

        {reviews && reviews.length > 0 && (
          <div className="reviews">
            <h4 className="admin-h">{t("Sharhlar")}</h4>
            {reviews.map((r, i) => (
              <div key={i} className="review">
                <div className="review-top"><Stars n={r.rating} /><span className="muted small">{r.author} · {formatDate(r.createdAt)}</span></div>
                {r.comment && <p>{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
