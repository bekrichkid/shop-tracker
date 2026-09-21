import { useState } from "react";

export default function ProfileTab({ user, theme, onToggleTheme, onOpenCategories, onExport, onLogout, onDeleteAccount }) {
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

      <div className="menu-list">
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
