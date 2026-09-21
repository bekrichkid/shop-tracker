import { useEffect, useState } from "react";
import { api } from "../api.js";
import { formatUzs } from "../format.js";
import { useT } from "../i18n.jsx";

const PROVIDER_LABEL = { payme: "Payme", click: "Click", demo: "Demo to'lov (sinov)" };

export default function CartSheet({ cart, providers, onChangeQty, onRemove, onClose, onPaid, savedContacts }) {
  const t = useT();
  const first = savedContacts?.[0];
  const [fullName, setFullName] = useState(first?.fullName || "");
  const [phone, setPhone] = useState(first?.phone || "+998");
  const [address, setAddress] = useState(first?.address || "");
  const [provider, setProvider] = useState(providers[0] || "");
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState("");
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // The server prices the cart (products, promo code, delivery), so what is shown is what is charged.
  const cartKey = JSON.stringify(cart.map((i) => [i.productId, i.quantity]));
  useEffect(() => {
    let live = true;
    if (cart.length === 0) return undefined;
    api
      .quote(cart.map((i) => ({ productId: i.productId, quantity: i.quantity })), promo)
      .then((q) => live && (setQuote(q), setError("")))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, promo]);

  const localSubtotal = cart.reduce((s, i) => s + i.unitPriceUzs * i.quantity, 0);
  const total = quote ? quote.total : localSubtotal;

  async function checkout(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (!provider) return setError(t("To'lov usuli hozircha mavjud emas"));
    if (quote?.promoError) return setError(quote.promoError);
    setBusy(true);
    try {
      const order = await api.createOrder({ items: cart, fullName, phone, address, promoCode: promo });
      const res = await api.payOrder(order.id, provider);
      const contact = { fullName, phone, address };
      if (res.payUrl) onPaid({ redirect: res.payUrl, orderId: order.id, contact });
      else onPaid({ status: "paid", orderId: order.id, contact });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet" role="dialog" aria-modal="true" aria-label={t("Savat")} onClick={(e) => e.stopPropagation()} onSubmit={checkout}>
        <div className="sheet-grab" />
        <div className="sheet-head">
          <h3>{t("Savat")}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t("Yopish")}>✕</button>
        </div>

        <ul className="cart-list">
          {cart.map((it) => (
            <li key={it.productId} className="cart-row">
              <img className="thumb" src={it.image} alt="" />
              <div className="row-main">
                <div className="row-title">{it.title}</div>
                <div className="row-sub">{formatUzs(it.unitPriceUzs)}</div>
              </div>
              <div className="qty">
                <button type="button" aria-label={t("Kamaytirish")} onClick={() => onChangeQty(it.productId, it.quantity - 1)}>−</button>
                <span>{it.quantity}</span>
                <button type="button" aria-label={t("Ko'paytirish")} onClick={() => onChangeQty(it.productId, it.quantity + 1)}>+</button>
              </div>
              <button type="button" className="icon-btn" aria-label={t("Olib tashlash")} onClick={() => onRemove(it.productId)}>✕</button>
            </li>
          ))}
        </ul>

        <div className="promo-row">
          <input placeholder={t("Promokod")} value={promoInput} onChange={(e) => setPromoInput(e.target.value)} autoCapitalize="characters" />
          <button type="button" className="btn btn-small btn-ghost" onClick={() => setPromo(promoInput.trim())} disabled={!promoInput.trim()}>{t("Qo'llash")}</button>
        </div>
        {promo && quote?.promoError && <div className="form-error">{quote.promoError}</div>}
        {promo && quote && !quote.promoError && quote.discount > 0 && <div className="form-info">{t("Promokod qo'llandi")}: −{formatUzs(quote.discount)}</div>}

        <div className="sum-lines">
          <div><span>{t("Tovarlar")}</span><span>{formatUzs(quote ? quote.subtotal : localSubtotal)}</span></div>
          {quote?.discount > 0 && <div className="disc"><span>{t("Chegirma")}</span><span>−{formatUzs(quote.discount)}</span></div>}
          {quote && (
            <div>
              <span>{t("Yetkazib berish")}</span>
              <span>{quote.delivery > 0 ? formatUzs(quote.delivery) : t("Bepul")}</span>
            </div>
          )}
        </div>
        {quote && quote.delivery > 0 && quote.freeDeliveryFrom > 0 && (
          <p className="muted small">{t("{sum} dan yuqori buyurtmada yetkazib berish bepul", { sum: formatUzs(quote.freeDeliveryFrom) })}</p>
        )}
        <div className="total-row">
          <span>{t("Jami")}</span>
          <span className="total-stack"><b>{formatUzs(total)}</b></span>
        </div>

        <h4 className="cat-section-title">{t("Yetkazib berish ma'lumotlari")}</h4>
        {savedContacts?.length > 1 && (
          <div className="chip-row">
            {savedContacts.map((c, i) => (
              <button type="button" key={i} className="chip" onClick={() => { setFullName(c.fullName); setPhone(c.phone); setAddress(c.address); }}>
                {c.address.slice(0, 28)}
              </button>
            ))}
          </div>
        )}
        <label className="field">
          <span>{t("Ism-familiya")}</span>
          <input autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </label>
        <label className="field">
          <span>{t("Telefon")}</span>
          <input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </label>
        <label className="field">
          <span>{t("Manzil")}</span>
          <input autoComplete="street-address" placeholder={t("Shahar, tuman, ko'cha, uy")} value={address} onChange={(e) => setAddress(e.target.value)} required />
        </label>

        {providers.length > 1 && (
          <div className="segmented">
            {providers.map((p) => (
              <button type="button" key={p} className={provider === p ? "seg-on" : ""} onClick={() => setProvider(p)}>
                {t(PROVIDER_LABEL[p] || p)}
              </button>
            ))}
          </div>
        )}
        {providers.length === 1 && providers[0] === "demo" && (
          <p className="muted small">{t("Sinov rejimi: to'lov haqiqiy pul yechmasdan darhol tasdiqlanadi.")}</p>
        )}

        {error && <div className="form-error" role="alert">{error}</div>}

        <button type="submit" className="btn btn-primary btn-block" disabled={busy || cart.length === 0}>
          {busy ? t("Iltimos kuting...") : `${t("To'lash")} · ${formatUzs(total)}`}
        </button>
      </form>
    </div>
  );
}
