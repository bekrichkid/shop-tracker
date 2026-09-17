export function formatSum(n) {
  const num = Number(n) || 0;
  return new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 2 }).format(num) + " $";
}

export function formatDate(d) {
  const date = new Date(d);
  return date.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}
