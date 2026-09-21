import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { formatSum } from "../format.js";

const SORTS = [
  { key: "default", label: "Odatiy" },
  { key: "price-asc", label: "Arzonroq" },
  { key: "price-desc", label: "Qimmatroq" },
  { key: "rating", label: "Reyting bo'yicha" },
];

export default function ProductGrid({ onBuy }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("default");
  const [buying, setBuying] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    setError("");
    api
      .getProducts()
      .then(setProducts)
      .catch(() => setError("Tovarlarni yuklab bo'lmadi. Internetni tekshirib, qayta urinib ko'ring."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const categories = useMemo(() => [...new Set(products.map((p) => p.category))], [products]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = products.filter((p) => (!category || p.category === category) && (!q || p.title.toLowerCase().includes(q)));
    if (sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    else if (sort === "rating") list = [...list].sort((a, b) => (b.rating?.rate || 0) - (a.rating?.rate || 0));
    return list;
  }, [products, query, category, sort]);

  function startBuy(product) {
    setBuying(product);
    setQuantity(1);
    setPrice(String(product.price));
  }

  async function confirmBuy() {
    if (busy || !price || Number(price) <= 0) return;
    setBusy(true);
    try {
      await onBuy({
        productId: buying.id,
        title: buying.title,
        image: buying.image,
        category: buying.category,
        quantity: Number(quantity) || 1,
        purchasePrice: Number(price),
      });
      setBuying(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="search-bar">
        <input type="search" placeholder="Tovar qidirish..." value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Tovar qidirish" />
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Saralash">
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="chip-row" role="tablist" aria-label="Kategoriyalar">
        <button className={"chip" + (!category ? " chip-active" : "")} onClick={() => setCategory("")}>Hammasi</button>
        {categories.map((c) => (
          <button key={c} className={"chip" + (category === c ? " chip-active" : "")} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>

      {loading && (
        <div className="product-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="product-card skeleton" />
          ))}
        </div>
      )}

      {error && (
        <div className="empty-state">
          <p>{error}</p>
          <button className="btn btn-primary" onClick={load}>Qayta urinish</button>
        </div>
      )}

      {!loading && !error && visible.length === 0 && <div className="empty-state">Hech narsa topilmadi.</div>}

      {!loading && !error && visible.length > 0 && (
        <div className="product-grid">
          {visible.map((p) => (
            <article key={p.id} className="product-card">
              <div className="product-image-wrap">
                <img src={p.image} alt={p.title} loading="lazy" />
              </div>
              <h3 className="product-title" title={p.title}>{p.title}</h3>
              <div className="product-meta">
                <span className="product-price">{formatSum(p.price)}</span>
                {p.rating && <span className="product-rating">★ {p.rating.rate}</span>}
              </div>
              <button className="btn btn-primary btn-block" onClick={() => startBuy(p)}>Sotib olish</button>
            </article>
          ))}
        </div>
      )}

      {buying && (
        <div className="sheet-backdrop" onClick={() => setBuying(null)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Sotib olish" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grab" />
            <div className="sheet-head">
              <h3>Sotib olish</h3>
              <button className="icon-btn" onClick={() => setBuying(null)} aria-label="Yopish">✕</button>
            </div>
            <div className="buy-preview">
              <img src={buying.image} alt="" />
              <div className="buy-title">{buying.title}</div>
            </div>
            <div className="form-row">
              <label className="field">
                <span>Miqdori</span>
                <input type="number" inputMode="numeric" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </label>
              <label className="field">
                <span>Dona narxi ($)</span>
                <input type="number" inputMode="decimal" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
              </label>
            </div>
            <div className="total-row">
              <span>Jami</span>
              <b>{formatSum(Number(price || 0) * Number(quantity || 0))}</b>
            </div>
            <button className="btn btn-primary btn-block" onClick={confirmBuy} disabled={busy}>
              {busy ? "Iltimos kuting..." : "Tasdiqlash"}
            </button>
            <p className="muted small center">Xarajat sifatida yoziladi va tovar omboringizga qo'shiladi.</p>
          </div>
        </div>
      )}
    </section>
  );
}
