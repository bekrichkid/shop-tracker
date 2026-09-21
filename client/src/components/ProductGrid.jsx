import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { formatSum } from "../format.js";

const SORTS = [
  { key: "default", label: "Odatiy" },
  { key: "price-asc", label: "Arzonroq" },
  { key: "price-desc", label: "Qimmatroq" },
  { key: "rating", label: "Reyting bo'yicha" },
];

export default function ProductGrid({ onAddToCart, cartQty, onCatalog }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("default");

  function load() {
    setLoading(true);
    setError("");
    api
      .getProducts()
      .then((list) => {
        setProducts(list);
        onCatalog?.(list);
      })
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
          {visible.map((p, idx) => (
            <article key={p.id} className="product-card" style={{ "--i": Math.min(idx, 10) }}>
              <div className="product-image-wrap">
                <img src={p.image} alt={p.title} loading="lazy" width="200" height="200" />
              </div>
              <h3 className="product-title" title={p.title}>{p.title}</h3>
              <div className="product-meta">
                <span className="product-price">{formatSum(p.price)}</span>
                {p.rating && <span className="product-rating">★ {p.rating.rate}</span>}
              </div>
              <button key={cartQty[p.id] || 0} className={"btn btn-primary btn-block" + (cartQty[p.id] ? " btn-added" : "")} onClick={() => onAddToCart(p)}>
                {cartQty[p.id] ? `Savatda: ${cartQty[p.id]} · yana qo'shish` : "Savatga qo'shish"}
              </button>
            </article>
          ))}
        </div>
      )}

    </section>
  );
}
