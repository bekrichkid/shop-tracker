// Payment provider configuration. Payme needs PAYME_MERCHANT_ID + PAYME_KEY; Click needs CLICK_SERVICE_ID,
// CLICK_MERCHANT_ID and CLICK_SECRET_KEY. The built-in demo provider (instant fake payment) is on by
// default only while no real provider is configured.
export function paymentConfig() {
  const payme = Boolean(process.env.PAYME_MERCHANT_ID && process.env.PAYME_KEY);
  const click = Boolean(process.env.CLICK_SERVICE_ID && process.env.CLICK_MERCHANT_ID && process.env.CLICK_SECRET_KEY);
  const demo = process.env.PAYMENT_DEMO ? process.env.PAYMENT_DEMO === "on" : !payme && !click;
  const rate = Number(process.env.USD_TO_UZS) || 12500;
  return { payme, click, demo, rate };
}

export function clickCheckoutUrl(order, returnUrl) {
  const q = new URLSearchParams({
    service_id: process.env.CLICK_SERVICE_ID,
    merchant_id: process.env.CLICK_MERCHANT_ID,
    amount: String(order.totalUzs),
    transaction_param: order.id,
  });
  if (returnUrl) q.set("return_url", returnUrl);
  return `https://my.click.uz/services/pay?${q.toString()}`;
}

export function paymeCheckoutUrl(order, returnUrl) {
  const tiyin = order.totalUzs * 100;
  const parts = [`m=${process.env.PAYME_MERCHANT_ID}`, `ac.order_id=${order.id}`, `a=${tiyin}`, "l=uz"];
  if (returnUrl) parts.push(`c=${returnUrl}`);
  const host = process.env.PAYME_TEST === "on" ? "checkout.test.paycom.uz" : "checkout.paycom.uz";
  return `https://${host}/${Buffer.from(parts.join(";")).toString("base64")}`;
}
