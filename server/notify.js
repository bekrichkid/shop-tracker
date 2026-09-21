import { db } from "./db.js";
import { formatUzsPlain } from "./format.js";

// Tells the shop owner about a paid order via a Telegram bot (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID).
// Never throws: a failed notification must not break a payment that already succeeded.
export async function notifyOrderPaid(orderId) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    const order = await db.getOrder(orderId);
    if (!order) return;
    const lines = order.items.map((i) => `• ${i.quantity} × ${i.title}`).join("\n");
    const text =
      `🛒 Yangi to'langan buyurtma #${order.id}\n\n${lines}\n\n` +
      `💰 ${formatUzsPlain(order.totalUzs)} so'm (${order.provider})\n` +
      `👤 ${order.fullName}\n📞 ${order.phone}\n📍 ${order.address}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
  } catch (err) {
    console.error("Telegram notification failed:", err.message);
  }
}
