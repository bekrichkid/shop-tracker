import { useState } from "react";
import { api } from "../api.js";
import { formatSum, formatUzs } from "../format.js";

const PROVIDER_LABEL = { payme: "Payme", demo: "Demo to'lov (sinov)" };

export default function CartSheet({ cart, providers, rate, onChangeQty, onRemove, onClose, onPaid, savedContact }) {
  const [fullName, setFullName] = useState(savedContact?.fullName || "");
  const [phone, setPhone] = useState(savedContact?.phone || "+998");
  const [address, setAddress] = useState(savedContact?.address || "");
  const [provider, setProvider] = useState(providers[0] || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const totalUsd = cart.reduce((s, i) => s + i.unitPriceUsd * i.quantity, 0);
  const totalUzs = Math.round(totalUsd * rate);

  async function checkout(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (!provider) return setError("To'lov usuli hozircha mavjud emas");
    setBusy(true);
    try {
      const order = await api.createOrder({ items: cart, fullName, phone, address });
      const res = await api.payOrder(order.id, provider);
      if (res.payUrl) {
        onPaid({ redirect: res.payUrl, orderId: order.id, contact: { fullName, phone, address } });
      } else {
        onPaid({ status: "paid", orderId: order.id, contact: { fullName, phone, address } });
      }
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet" role="dialog" aria-modal="true" aria-label="Savat" onClick={(e) => e.stopPropagation()} onSubmit={checkout}>
        <div className="sheet-grab" />
        <div className="sheet-head">
          <h3>Savat</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Yopish">✕</button>
        </div>

        <ul className="cart-list">
          {cart.map((it) => (
            <li key={it.productId} className="cart-row">
              <img className="thumb" src={it.image} alt="" />
              <div className="row-main">
                <div className="row-title">{it.title}</div>
                <div className="row-sub">{formatSum(it.unitPriceUsd)}</div>
              </div>
              <div className="qty">
                <button type="button" aria-label="Kamaytirish" onClick={() => onChangeQty(it.productId, it.quantity - 1)}>−</button>
                <span>{it.quantity}</span>
                <button type="button" aria-label="Ko'paytirish" onClick={() => onChangeQty(it.productId, it.quantity + 1)}>+</button>
              </div>
              <button type="button" className="icon-btn" aria-label="Olib tashlash" onClick={() => onRemove(it.productId)}>✕</button>
            </li>
          ))}
        </ul>

        <div className="total-row">
          <span>Jami</span>
          <span className="total-stack">
            <b>{formatUzs(totalUzs)}</b>
            <small className="muted">{formatSum(totalUsd)}</small>
          </span>
        </div>

        <h4 className="cat-section-title">Yetkazib berish</h4>
        <label className="field">
          <span>Ism-familiya</span>
          <input autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </label>
        <label className="field">
          <span>Telefon</span>
          <input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </label>
        <label className="field">
          <span>Manzil</span>
          <input autoComplete="street-address" placeholder="Shahar, tuman, ko'cha, uy" value={address} onChange={(e) => setAddress(e.target.value)} required />
        </label>

        {providers.length > 1 && (
          <div className="segmented">
            {providers.map((p) => (
              <button type="button" key={p} className={provider === p ? "seg-on" : ""} onClick={() => setProvider(p)}>
                {PROVIDER_LABEL[p] || p}
              </button>
            ))}
          </div>
        )}
        {providers.length === 1 && providers[0] === "demo" && (
          <p className="muted small">Sinov rejimi: to'lov haqiqiy pul yechmasdan darhol tasdiqlanadi.</p>
        )}

        {error && <div className="form-error" role="alert">{error}</div>}

        <button type="submit" className="btn btn-primary btn-block" disabled={busy || cart.length === 0}>
          {busy ? "Iltimos kuting..." : `To'lash · ${formatUzs(totalUzs)}`}
        </button>
      </form>
    </div>
  );
}
