import { useState } from "react";
import { api } from "../api.js";

export default function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const fn = mode === "login" ? api.login : api.register;
      const res = await fn(email.trim(), password);
      onAuthed(res.token, res.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand-mark" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <path d="M3 6h18" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
        </div>
        <h1 className="auth-title">Tovar Do'koni</h1>
        <p className="auth-sub">Xarid qiling, soting va foydangizni kuzating</p>

        <div className="segmented" role="tablist">
          <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "seg-on" : ""} onClick={() => { setMode("login"); setError(""); }}>
            Kirish
          </button>
          <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "seg-on" : ""} onClick={() => { setMode("register"); setError(""); }}>
            Ro'yxatdan o'tish
          </button>
        </div>

        <form onSubmit={submit} className="auth-form">
          <label className="field">
            <span>Email</span>
            <input type="email" autoComplete="email" inputMode="email" placeholder="siz@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="field">
            <span>Parol</span>
            <div className="pw-wrap">
              <input
                type={showPw ? "text" : "password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder={mode === "register" ? "Kamida 8 belgi" : "Parolingiz"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="button" className="pw-toggle" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Parolni yashirish" : "Parolni ko'rsatish"}>
                {showPw ? "Yashirish" : "Ko'rsatish"}
              </button>
            </div>
          </label>

          {error && <div className="form-error" role="alert">{error}</div>}

          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Iltimos kuting..." : mode === "login" ? "Kirish" : "Hisob yaratish"}
          </button>
        </form>

        <p className="auth-legal">
          Davom etish orqali <a href="/privacy.html" target="_blank" rel="noreferrer">maxfiylik siyosati</a>ga rozilik bildirasiz.
        </p>
      </div>
    </div>
  );
}
