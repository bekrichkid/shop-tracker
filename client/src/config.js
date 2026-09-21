// Empty locally (Vite proxy handles /api). On Netlify, same-origin redirects handle /api,
// so this can stay empty there too — kept only for parity/override flexibility.
export const API_BASE = import.meta.env.VITE_API_URL || "";

// True inside the iOS/Android app (Capacitor). There, /api must point at the live server and
// payment pages open in an in-app browser instead of replacing the app.
export const IS_NATIVE = Boolean(typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.());
