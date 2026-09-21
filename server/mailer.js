// Transactional email through Resend (RESEND_API_KEY + MAIL_FROM). Without a key every send is a no-op,
// so the shop works without email and simply starts emailing once the key is configured.
export const mailEnabled = () => Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);

export async function sendMail(to, subject, text) {
  if (!mailEnabled() || !to) return false;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) console.error("Mail failed:", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (err) {
    console.error("Mail failed:", err.message);
    return false;
  }
}
