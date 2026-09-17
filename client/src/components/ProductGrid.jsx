import { useEffect, useState } from "react";
import { api } from "../api.js";
import { formatSum } from "../format.js";

export default function ProductGrid({ onBuy }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [buying, setBuying] = useState(null); // product being bought
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState("");

  useEffect(() => {
    api.getProductCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError("");
    api
      .getProducts(category)
      .then(setProducts)
      .catch(() => setError("Tovarlarni yuklab bo'lmadi. Birozdan keyin urinib ko'ring."))
      .finally(() => setLoading(false));
  }, [category]);

  function startBuy(product) {
    setBuying(product);
    setQuantity(1);
    setPrice(String(product.price));
  }

  async function confirmBuy() {
    if (!price || Number(price) <= 0) return;
    await onBuy({
      productId: buying.id,
      title: buying.title,
      image: buying.image,
      category: buying.category,
      quantity: Number(quantity) || 1,
      purchasePrice: Number(price),
    });
    setBuying(null);
  }

  return (
    <section>
      <div className="shop-toolbar">
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Barcha kategoriyalar</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {loading && <div className="empty-state">Yuklanmoqda...</div>}
      {error && <div className="empty-state">{error}</div>}

      {!loading && !error && (
        <div className="product-grid">
          {products.map((p) => (
            <div key={p.id} className="product-card">
              <div className="product-image-wrap">
                <img src={p.image} alt={p.title} loading="lazy" />
              </div>
              <div className="product-title" title={p.title}>{p.title}</div>
              <div className="product-meta">
                <span className="product-price">{formatSum(p.price)}</span>
                {p.rating && <span className="product-rating">★ {p.rating.rate}</span>}
              </div>
              <button className="submit-btn small" onClick={() => startBuy(p)}>Sotib olish</button>
            </div>
          ))}
        </div>
      )}

      {buying && (
        <div className="modal-backdrop" onClick={() => setBuying(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Sotib olish</h3>
              <button className="link-btn" onClick={() => setBuying(null)}>Yopish</button>
            </div>
            <div className="buy-preview">
              <img src={buying.image} alt={buying.title} />
              <div className="buy-title">{buying.title}</div>
            </div>
            <label className="field-label">Miqdori</label>
            <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            <label className="field-label">Dona narxi ($)</label>
            <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            <div className="buy-total">Jami: {formatSum(Number(price || 0) * Number(quantity || 0))}</div>
            <button className="submit-btn" onClick={confirmBuy}>Tasdiqlash va xarajat sifatida yozish</button>
          </div>
        </div>
      )}
    </section>
  );
}
