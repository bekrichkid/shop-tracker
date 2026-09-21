import { useState } from "react";
import { api } from "../api.js";
import { useT } from "../i18n.jsx";
import LangSwitch from "./LangSwitch.jsx";

function ChangePassword({ onDone }) {
  const t = useT();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.changePassword(current, next);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="pw-form" onSubmit={submit}>
      <label className="field">
        <span>{t("Joriy parol")}</span>
        <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </label>
      <label className="field">
        <span>{t("Yangi parol")}</span>
        <input type="password" autoComplete="new-password" placeholder={t("Kamida 8 belgi")} value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} />
      </label>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="btn btn-primary btn-block" disabled={busy}>{busy ? t("Iltimos kuting...") : t("Parolni saqlash")}</button>
    </form>
  );
}

export default function ProfileTab({ store, user, theme, onToggleTheme, onOpenCategories, onExport, onExportOrders, onOpenSettings, onOpenPromos, onLogout, onDeleteAccount, onToast }) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  async function doDelete() {
    setBusy(true);
    try {
      await onDeleteAccount();
    } finally {
      setBusy(false);
    }
  }

  const Item = ({ onClick, href, children, ...rest }) =>
    href ? (
      <a className="menu-item" href={href} {...rest}>
        <span>{children}</span>
        <span className="chev">›</span>
      </a>
    ) : (
      <button className="menu-item" onClick={onClick}>
        <span>{children}</span>
        <span className="chev">›</span>
      </button>
    );

  return (
    <div className="profile">
      <div className="profile-head">
        <div className="avatar" aria-hidden="true">{(user?.email || "?")[0].toUpperCase()}</div>
        <div>
          <div className="profile-email">{user?.email}</div>
          <div className="muted small">{user?.isAdmin ? t("Sotuvchi (administrator)") : t("Mijoz")}</div>
        </div>
      </div>

      <div className="menu-list">
        {user?.isAdmin && (
          <>
            <Item onClick={onOpenSettings}>Do'kon sozlamalari (yetkazish, aloqa)</Item>
            <Item onClick={onOpenPromos}>Promokodlar</Item>
            <Item onClick={onOpenCategories}>Moliya kategoriyalari va oylik limitlar</Item>
            <Item onClick={onExport}>Moliya yozuvlarini CSV qilib yuklash</Item>
            <Item onClick={onExportOrders}>Buyurtmalarni CSV qilib yuklash</Item>
          </>
        )}
        <div className="menu-item menu-static">
          <span>{t("Til")}</span>
          <LangSwitch />
        </div>
        <Item onClick={onToggleTheme}>{t("Ko'rinish")}: {theme === "light" ? t("Kunduzgi") : t("Tungi")}</Item>
        <Item onClick={() => setChangingPw((v) => !v)}>{t("Parolni o'zgartirish")}</Item>
        {changingPw && (
          <div className="menu-panel">
            <ChangePassword onDone={() => { setChangingPw(false); onToast(t("Parol o'zgartirildi")); }} />
          </div>
        )}
        {store?.phone && (
          <Item href={`tel:${store.phone.replace(/\s/g, "")}`}>{t("Qo'ng'iroq")}: {store.phone}{store.hours ? ` · ${store.hours}` : ""}</Item>
        )}
        {store?.telegram && (
          <Item href={store.telegram.startsWith("http") ? store.telegram : `https://t.me/${store.telegram.replace(/^@/, "")}`} target="_blank" rel="noreferrer">
            {t("Telegram orqali yozish")}
          </Item>
        )}
        <Item href="/oferta.html" target="_blank" rel="noreferrer">{t("Foydalanish shartlari (oferta)")}</Item>
        <Item href="/qaytarish.html" target="_blank" rel="noreferrer">{t("Qaytarish va almashtirish")}</Item>
        <Item href="/privacy.html" target="_blank" rel="noreferrer">{t("Maxfiylik siyosati")}</Item>
      </div>

      <button className="btn btn-block btn-ghost" onClick={onLogout}>{t("Chiqish")}</button>

      <div className="danger-zone">
        <h3>{t("Hisobni o'chirish")}</h3>
        <p className="muted small">{t("Hisobingiz va buyurtmalar tarixi butunlay o'chiriladi. Buni qaytarib bo'lmaydi.")}</p>
        {!confirming ? (
          <button className="btn btn-danger-outline" onClick={() => setConfirming(true)}>{t("Hisobni o'chirish")}</button>
        ) : (
          <div className="confirm-row">
            <button className="btn btn-danger" onClick={doDelete} disabled={busy}>
              {busy ? t("O'chirilmoqda...") : t("Ha, butunlay o'chirish")}
            </button>
            <button className="btn btn-ghost" onClick={() => setConfirming(false)} disabled={busy}>{t("Bekor qilish")}</button>
          </div>
        )}
      </div>
    </div>
  );
}
