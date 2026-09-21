import crypto from "crypto";
import { db } from "./db.js";
import { notifyOrderPaid } from "./notify.js";

// Payme Merchant API (JSON-RPC 2.0). Payme calls this endpoint; it authenticates with
// HTTP Basic "Paycom:<PAYME_KEY>". Amounts are in tiyin (1 so'm = 100 tiyin). Every reply is HTTP 200.
const TIMEOUT_MS = 12 * 60 * 60 * 1000;

const MESSAGES = {
  "-32504": { ru: "Недостаточно привилегий для выполнения метода", uz: "Metodni bajarish uchun huquq yetarli emas", en: "Insufficient privilege to perform this method" },
  "-32601": { ru: "Метод не найден", uz: "Metod topilmadi", en: "Method not found" },
  "-32400": { ru: "Системная ошибка", uz: "Tizim xatosi", en: "System error" },
  "-31001": { ru: "Неверная сумма", uz: "Noto'g'ri summa", en: "Wrong amount" },
  "-31003": { ru: "Транзакция не найдена", uz: "Tranzaksiya topilmadi", en: "Transaction not found" },
  "-31007": { ru: "Заказ выполнен. Невозможно отменить транзакцию", uz: "Buyurtma bajarilgan. Tranzaksiyani bekor qilib bo'lmaydi", en: "Order completed. Cannot cancel the transaction" },
  "-31008": { ru: "Невозможно выполнить операцию", uz: "Amalni bajarib bo'lmaydi", en: "Unable to perform operation" },
  "-31050": { ru: "Заказ не найден", uz: "Buyurtma topilmadi", en: "Order not found" },
  "-31051": { ru: "Заказ не ожидает оплаты", uz: "Buyurtma to'lovni kutmayapti", en: "Order is not awaiting payment" },
  "-31099": { ru: "У заказа есть активная транзакция", uz: "Buyurtmada faol tranzaksiya bor", en: "Order already has an active transaction" },
};

function rpcError(code, data) {
  const e = new Error(`rpc ${code}`);
  e.rpc = { code, message: MESSAGES[String(code)] || MESSAGES["-32400"], ...(data ? { data } : {}) };
  return e;
}

function authorized(req) {
  const key = process.env.PAYME_KEY;
  if (!key) return false;
  const header = req.headers.authorization || "";
  if (!header.startsWith("Basic ")) return false;
  const given = Buffer.from(header.slice(6), "base64");
  const expected = Buffer.from(`Paycom:${key}`);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

async function validateOrder(params) {
  const order = await db.getOrder(params?.account?.order_id);
  if (!order) throw rpcError(-31050, "order_id");
  if (order.status !== "pending") throw rpcError(-31051, "order_id");
  if (Number(params.amount) !== order.totalUzs * 100) throw rpcError(-31001);
  return order;
}

const timedOut = (p) => Date.now() - p.createTime > TIMEOUT_MS;

async function cancelForTimeout(p) {
  await db.updatePayment(p.id, { state: -1, reason: 4, cancelTime: Date.now() });
}

const methods = {
  async CheckPerformTransaction(params) {
    await validateOrder(params);
    return { allow: true };
  },

  async CreateTransaction(params) {
    const existing = await db.getPayment(params.id);
    if (existing) {
      if (existing.state !== 1) throw rpcError(-31008);
      if (timedOut(existing)) {
        await cancelForTimeout(existing);
        throw rpcError(-31008);
      }
      return { create_time: existing.createTime, transaction: existing.id, state: 1 };
    }
    const order = await validateOrder(params);
    if (await db.getActivePaymentForOrder(order.id)) throw rpcError(-31099, "order_id");
    const p = await db.createPayment({ id: params.id, orderId: order.id, amount: Number(params.amount), time: Number(params.time) || Date.now() });
    return { create_time: p.createTime, transaction: p.id, state: 1 };
  },

  async PerformTransaction(params) {
    const p = await db.getPayment(params.id);
    if (!p) throw rpcError(-31003);
    if (p.state === 2) return { transaction: p.id, perform_time: p.performTime, state: 2 };
    if (p.state !== 1) throw rpcError(-31008);
    if (timedOut(p)) {
      await cancelForTimeout(p);
      throw rpcError(-31008);
    }
    if (!(await db.markOrderPaid(p.orderId, "payme", p.id))) throw rpcError(-31008);
    await notifyOrderPaid(p.orderId);
    const done = await db.updatePayment(p.id, { state: 2, performTime: Date.now() });
    return { transaction: done.id, perform_time: done.performTime, state: 2 };
  },

  async CancelTransaction(params) {
    const p = await db.getPayment(params.id);
    if (!p) throw rpcError(-31003);
    const reason = params.reason ?? null;
    if (p.state === 1) {
      const c = await db.updatePayment(p.id, { state: -1, reason, cancelTime: Date.now() });
      return { transaction: c.id, cancel_time: c.cancelTime, state: -1 };
    }
    if (p.state === 2) {
      if (!(await db.refundPaidOrder(p.orderId))) throw rpcError(-31007);
      const c = await db.updatePayment(p.id, { state: -2, reason, cancelTime: Date.now() });
      return { transaction: c.id, cancel_time: c.cancelTime, state: -2 };
    }
    return { transaction: p.id, cancel_time: p.cancelTime, state: p.state };
  },

  async CheckTransaction(params) {
    const p = await db.getPayment(params.id);
    if (!p) throw rpcError(-31003);
    return {
      create_time: p.createTime,
      perform_time: p.performTime,
      cancel_time: p.cancelTime,
      transaction: p.id,
      state: p.state,
      reason: p.reason ?? null,
    };
  },

  async GetStatement(params) {
    const list = await db.listPayments(Number(params.from), Number(params.to));
    return {
      transactions: list.map((p) => ({
        id: p.id,
        time: p.createTime,
        amount: p.amount,
        account: { order_id: p.orderId },
        create_time: p.createTime,
        perform_time: p.performTime,
        cancel_time: p.cancelTime,
        transaction: p.id,
        state: p.state,
        reason: p.reason ?? null,
      })),
    };
  },
};

export async function paymeHandler(req, res) {
  const { id = null, method, params = {} } = req.body || {};
  const reply = (body) => res.status(200).json({ jsonrpc: "2.0", id, ...body });
  if (!authorized(req)) return reply({ error: rpcError(-32504).rpc });
  const fn = Object.prototype.hasOwnProperty.call(methods, method) ? methods[method] : null;
  if (!fn) return reply({ error: rpcError(-32601).rpc });
  try {
    reply({ result: await fn(params) });
  } catch (err) {
    if (err.rpc) return reply({ error: err.rpc });
    console.error(err);
    reply({ error: rpcError(-32400).rpc });
  }
}
