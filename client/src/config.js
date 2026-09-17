// Empty locally (Vite proxy handles /api). On Netlify, same-origin redirects handle /api,
// so this can stay empty there too — kept only for parity/override flexibility.
export const API_BASE = import.meta.env.VITE_API_URL || "";
