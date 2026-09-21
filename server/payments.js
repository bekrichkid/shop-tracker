// Payment provider configuration. Payme is used when PAYME_MERCHANT_ID and PAYME_KEY are set;
// the built-in demo provider (instant fake payment) is on by default only until Payme is configured.
export function paymentConfig() {
  const payme = Boolean(process.env.PAYME_MERCHANT_ID && process.env.PAYME_KEY);
  const demo = process.env.PAYMENT_DEMO ? process.env.PAYMENT_DEMO === "on" : !payme;
  const rate = Number(process.env.USD_TO_UZS) || 12500;
  return { payme, demo, rate };
}

export function paymeCheckoutUrl(order, returnUrl) {
  const tiyin = order.totalUzs * 100;
  const parts = [`m=${process.env.PAYME_MERCHANT_ID}`, `ac.order_id=${order.id}`, `a=${tiyin}`, "l=uz"];
  if (returnUrl) parts.push(`c=${returnUrl}`);
  const host = process.env.PAYME_TEST === "on" ? "checkout.test.paycom.uz" : "checkout.paycom.uz";
  return `https://${host}/${Buffer.from(parts.join(";")).toString("base64")}`;
}
