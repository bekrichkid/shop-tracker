import { useState } from "react";

export default function ProfileTab({ store, onOpenAdmin, user, theme, onToggleTheme, onOpenCategories, onOpenOrders, onExport, onLogout, onDeleteAccount }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function doDelete() {
    setBusy(true);
    try {
      await onDeleteAccount();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="profile">
      <div className="profile-head">
        <div className="avatar" aria-hidden="true">{(user?.email || "?")[0].toUpperCase()}</div>
        <div>
          <div className="profile-email">{user?.email}</div>
          <div className="muted small">Shaxsiy hisob</div>
        </div>
      </div>

      {user?.isAdmin && (
        <button className="admin-entry" onClick={onOpenAdmin}>
          <span>
            <b>Boshqaruv paneli</b>
            <span className="muted small">Buyurtmalar, tovarlar va statistika</span>
          </span>
          <span className="chev">›</span>
        </button>
      )}

      <div className="menu-list">
        <button className="menu-item" onClick={onOpenOrders}>
          <span>Buyurtmalarim</span>
          <span className="chev">›</span>
        </button>
        <button className="menu-item" onClick={onOpenCategories}>
          <span>Kategoriyalar va oylik limitlar</span>
          <span className="chev">›</span>
        </button>
        <button className="menu-item" onClick={onExport}>
          <span>Tranzaksiyalarni CSV qilib yuklash</span>
          <span className="chev">›</span>
        </button>
        <button className="menu-item" onClick={onToggleTheme}>
          <span>Ko'rinish: {theme === "light" ? "Kunduzgi" : "Tungi"}</span>
          <span className="chev">›</span>
        </button>
        {store?.phone && (
          <a className="menu-item" href={`tel:${store.phone.replace(/\s/g, "")}`}>
            <span>Qo'ng'iroq: {store.phone}{store.hours ? ` · ${store.hours}` : ""}</span>
            <span className="chev">›</span>
          </a>
        )}
        {store?.telegram && (
          <a className="menu-item" href={store.telegram.startsWith("http") ? store.telegram : `https://t.me/${store.telegram.replace(/^@/, "")}`} target="_blank" rel="noreferrer">
            <span>Telegram orqali yozish</span>
            <span className="chev">›</span>
          </a>
        )}
        <a className="menu-item" href="/privacy.html" target="_blank" rel="noreferrer">
          <span>Maxfiylik siyosati</span>
          <span className="chev">›</span>
        </a>
      </div>

      <button className="btn btn-block btn-ghost" onClick={onLogout}>Chiqish</button>

      <div className="danger-zone">
        <h3>Hisobni o'chirish</h3>
        <p className="muted small">Hisobingiz va barcha tranzaksiyalar, ombor, kategoriyalar butunlay o'chiriladi. Buni qaytarib bo'lmaydi.</p>
        {!confirming ? (
          <button className="btn btn-danger-outline" onClick={() => setConfirming(true)}>Hisobni o'chirish</button>
        ) : (
          <div className="confirm-row">
            <button className="btn btn-danger" onClick={doDelete} disabled={busy}>
              {busy ? "O'chirilmoqda..." : "Ha, butunlay o'chirish"}
            </button>
            <button className="btn btn-ghost" onClick={() => setConfirming(false)} disabled={busy}>Bekor qilish</button>
          </div>
        )}
      </div>
    </div>
  );
}
