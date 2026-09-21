import { tr } from "./i18n.jsx";

// All money in the app is in so'm.
export function formatSum(n) {
  return new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 }).format(Number(n) || 0) + " " + tr("so'm");
}

export function formatDate(d) {
  const date = new Date(d);
  return date.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatUzs(n) {
  return new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 }).format(Number(n) || 0) + " " + tr("so'm");
}
