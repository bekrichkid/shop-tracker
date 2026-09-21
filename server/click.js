import crypto from "crypto";
import { db } from "./db.js";
import { notifyOrderPaid } from "./notify.js";

// Click SHOP-API. Click POSTs form-encoded requests to one URL (registered as both the Prepare and
// Complete URL in the Click cabinet); `action` 0 = Prepare, 1 = Complete. Replies are JSON, HTTP 200.
// Amounts are in so'm. sign_string = md5 of the fields concatenated in a fixed order with the secret.
const ERR = {
  OK: [0, "Success"],
  SIGN: [-1, "SIGN CHECK FAILED!"],
  AMOUNT: [-2, "Incorrect parameter amount"],
  ACTION: [-3, "Action not found"],
  PAID: [-4, "Already paid"],
  NO_ORDER: [-5, "User does not exist"],
  NO_TX: [-6, "Transaction does not exist"],
  REQUEST: [-8, "Error in request from click"],
  CANCELLED: [-9, "Transaction cancelled"],
};

const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");
const str = (v) => (v === undefined || v === null ? "" : String(v));

function signOk(b, action) {
  const secret = process.env.CLICK_SECRET_KEY;
  const parts =
    action === 0
      ? [b.click_trans_id, b.service_id, secret, b.merchant_trans_id, b.amount, b.action, b.sign_time]
      : [b.click_trans_id, b.service_id, secret, b.merchant_trans_id, b.merchant_prepare_id, b.amount, b.action, b.sign_time];
  const expected = Buffer.from(md5(parts.map(str).join("")));
  const given = Buffer.from(str(b.sign_string).toLowerCase());
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

const sameAmount = (given, order) => Math.abs(Number(given) - order.totalUzs) < 0.01;

export async function clickHandler(req, res) {
  const b = req.body || {};
  const reply = (key, extra = {}) => {
    const [error, error_note] = ERR[key];
    res.status(200).json({ click_trans_id: b.click_trans_id, merchant_trans_id: b.merchant_trans_id, ...extra, error, error_note });
  };
  try {
    if (!process.env.CLICK_SECRET_KEY || !process.env.CLICK_SERVICE_ID) return reply("REQUEST");
    const action = Number(b.action);
    if (action !== 0 && action !== 1) return reply("ACTION");
    if (str(b.service_id) !== process.env.CLICK_SERVICE_ID || !b.click_trans_id || !b.merchant_trans_id) return reply("REQUEST");
    if (!signOk(b, action)) return reply("SIGN");

    const order = await db.getOrder(str(b.merchant_trans_id));
    if (!order) return reply("NO_ORDER");

    if (action === 0) {
      const existing = await db.getClickTx(b.click_trans_id);
      if (existing) {
        if (existing.order_id !== order.id) return reply("REQUEST");
        if (existing.state === "completed") return reply("PAID");
        if (existing.state === "cancelled") return reply("CANCELLED");
        return reply("OK", { merchant_prepare_id: existing.prepare_id });
      }
      if (order.status === "paid") return reply("PAID");
      if (order.status === "cancelled") return reply("CANCELLED");
      if (!sameAmount(b.amount, order)) return reply("AMOUNT");
      const tx = await db.createClickTx({ clickTransId: b.click_trans_id, orderId: order.id, amount: order.totalUzs });
      return reply("OK", { merchant_prepare_id: tx.prepare_id });
    }

    // Complete
    const tx = await db.getClickTx(b.click_trans_id);
    if (!tx || tx.prepare_id !== str(b.merchant_prepare_id) || tx.order_id !== order.id) return reply("NO_TX");
    if (tx.state === "completed") return reply("PAID", { merchant_confirm_id: tx.prepare_id });
    if (tx.state === "cancelled") return reply("CANCELLED");
    if (Number(b.error) < 0) {
      await db.setClickTxState(tx.click_trans_id, "cancelled");
      return reply("CANCELLED");
    }
    if (!sameAmount(b.amount, order)) return reply("AMOUNT");
    if (!(await db.markOrderPaid(order.id, "click", tx.click_trans_id))) {
      // Order was paid another way or cancelled while the customer was on Click's page.
      if (order.status === "paid") return reply("PAID");
      await db.setClickTxState(tx.click_trans_id, "cancelled");
      return reply("CANCELLED");
    }
    await db.setClickTxState(tx.click_trans_id, "completed");
    await notifyOrderPaid(order.id);
    return reply("OK", { merchant_confirm_id: tx.prepare_id });
  } catch (err) {
    console.error("Click handler error:", err);
    res.status(200).json({ click_trans_id: b.click_trans_id, merchant_trans_id: b.merchant_trans_id, error: -7, error_note: "Failed to update user" });
  }
}
