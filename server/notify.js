import { db } from "./db.js";
import { formatUzsPlain } from "./format.js";
import { sendMail } from "./mailer.js";

// Tells the shop owner about a paid order via a Telegram bot (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID).
// Never throws: a failed notification must not break a payment that already succeeded.
async function telegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

const STATUS_TEXT = {
  processing: "Buyurtmangiz tayyorlanmoqda.",
  shipped: "Buyurtmangiz yo'lga chiqdi.",
  delivered: "Buyurtmangiz yetkazildi. Xaridingiz uchun rahmat! Tovarni ilova ichida baholashingiz mumkin.",
};

// Emails the customer when the shop moves their order to a new stage.
export async function notifyStatusChange(order, fulfillment) {
  if (!STATUS_TEXT[fulfillment]) return;
  try {
    const user = await db.findUserById(order.customerId);
    if (!user) return;
    const note = order.adminNote ? `\n\nIzoh: ${order.adminNote}` : "";
    await sendMail(user.email, `Buyurtma #${order.id}`, `${STATUS_TEXT[fulfillment]}${note}`);
  } catch (err) {
    console.error("Status mail failed:", err.message);
  }
}

export async function notifyOrderPaid(orderId) {
  try {
    const order = await db.getOrder(orderId);
    if (!order) return;
    const user = await db.findUserById(order.customerId);
    if (user) {
      await sendMail(
        user.email,
        `Buyurtma #${order.id} qabul qilindi`,
        `Rahmat! To'lovingiz qabul qilindi.\n\n${order.items.map((i) => `${i.quantity} × ${i.title}`).join("\n")}\n\nJami: ${formatUzsPlain(order.totalUzs)} so'm\nManzil: ${order.address}\n\nBuyurtma holatini ilovada "Buyurtmalarim" bo'limida kuzatishingiz mumkin.`
      );
    }
    const low = await db.lowStockAmong(order.items.map((i) => i.productId).filter(Boolean));
    const lines = order.items.map((i) => `• ${i.quantity} × ${i.title}`).join("\n");
    const extras = (order.discountUzs ? `\n🏷 Chegirma: ${formatUzsPlain(order.discountUzs)} so'm (${order.promoCode})` : "") + (order.deliveryUzs ? `\n🚚 Yetkazish: ${formatUzsPlain(order.deliveryUzs)} so'm` : "");
    await telegram(
      `🛒 Yangi to'langan buyurtma #${order.id}\n\n${lines}${extras}\n\n` +
        `💰 ${formatUzsPlain(order.totalUzs)} so'm (${order.provider})\n` +
        `👤 ${order.fullName}\n📞 ${order.phone}\n📍 ${order.address}`
    );
    if (low.length) await telegram(`⚠️ Zaxira tugayapti:\n${low.map((p) => `• ${p.title}: ${p.stock} dona`).join("\n")}`);
  } catch (err) {
    console.error("Order notification failed:", err.message);
  }
}
