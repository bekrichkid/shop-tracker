export const formatUzsPlain = (n) => Math.round(Number(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
