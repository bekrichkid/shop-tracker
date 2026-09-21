import { useState } from "react";
import { api } from "../api.js";
import { useT } from "../i18n.jsx";
import LangSwitch from "./LangSwitch.jsx";

export default function AuthScreen({ onAuthed, resetToken, onResetDone }) {
  const t = useT();
  const [mode, setMode] = useState(resetToken ? "reset" : "login"); // login | register | forgot | reset
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  function switchMode(m) {
    setMode(m);
    setError("");
    setInfo("");
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setInfo("");
    setBusy(true);
    try {
      if (mode === "forgot") {
        const res = await api.forgot(email.trim());
        setInfo(
          res.emailEnabled
            ? t("Agar bu email ro'yxatdan o'tgan bo'lsa, parolni tiklash havolasi yuborildi. Pochtangizni tekshiring.")
            : t("Email orqali tiklash hozircha yoqilmagan. Do'kon bilan bog'laning, sizga vaqtinchalik parol berishadi.")
        );
      } else if (mode === "reset") {
        await api.resetPassword(resetToken, password);
        setInfo(t("Parol yangilandi. Endi yangi parol bilan kiring."));
        setPassword("");
        onResetDone?.();
        setMode("login");
      } else {
        const res = await (mode === "login" ? api.login : api.register)(email.trim(), password);
        onAuthed(res.token, res.user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const title = { login: "Kirish", register: "Hisob yaratish", forgot: "Parolni tiklash", reset: "Yangi parol" }[mode];

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-top"><LangSwitch /></div>
        <div className="brand-mark" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <path d="M3 6h18" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
        </div>
        <h1 className="auth-title">Tovar Do'koni</h1>
        <p className="auth-sub">{t("Qulay narxlarda sifatli tovarlar")}</p>

        {(mode === "login" || mode === "register") && (
          <div className="segmented" role="tablist">
            <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "seg-on" : ""} onClick={() => switchMode("login")}>
              {t("Kirish")}
            </button>
            <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "seg-on" : ""} onClick={() => switchMode("register")}>
              {t("Ro'yxatdan o'tish")}
            </button>
          </div>
        )}
        {(mode === "forgot" || mode === "reset") && <h2 className="auth-mode-title">{t(title)}</h2>}

        <form onSubmit={submit} className="auth-form">
          {mode !== "reset" && (
            <label className="field">
              <span>Email</span>
              <input type="email" autoComplete="email" inputMode="email" placeholder="siz@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
          )}
          {mode !== "forgot" && (
            <label className="field">
              <span>{mode === "reset" ? t("Yangi parol") : t("Parol")}</span>
              <div className="pw-wrap">
                <input
                  type={showPw ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder={mode === "login" ? t("Parolingiz") : t("Kamida 8 belgi")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button type="button" className="pw-toggle" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? t("Parolni yashirish") : t("Parolni ko'rsatish")}>
                  {showPw ? t("Yashirish") : t("Ko'rsatish")}
                </button>
              </div>
            </label>
          )}

          {error && <div className="form-error" role="alert">{error}</div>}
          {info && <div className="form-info" role="status">{info}</div>}

          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? t("Iltimos kuting...") : mode === "forgot" ? t("Havola yuborish") : mode === "reset" ? t("Parolni saqlash") : mode === "login" ? t("Kirish") : t("Hisob yaratish")}
          </button>
        </form>

        {mode === "login" && (
          <button type="button" className="link-btn auth-forgot" onClick={() => switchMode("forgot")}>{t("Parolni unutdingizmi?")}</button>
        )}
        {(mode === "forgot" || mode === "reset") && (
          <button type="button" className="link-btn auth-forgot" onClick={() => switchMode("login")}>{t("Kirishga qaytish")}</button>
        )}

        <p className="auth-legal">
          {t("Davom etish orqali")} <a href="/oferta.html" target="_blank" rel="noreferrer">{t("foydalanish shartlari")}</a> {t("va")}{" "}
          <a href="/privacy.html" target="_blank" rel="noreferrer">{t("maxfiylik siyosati")}</a>{t("ga rozilik bildirasiz.")}
        </p>
      </div>
    </div>
  );
}
