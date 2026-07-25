import { formatIDR } from "./format";

export function buildAdminOrderAlertUrl(phone, order) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  const text = encodeURIComponent(
    `Order baru Imzaqi Store!\n\nID: ${order?.order_code || "-"}\nTotal: ${formatIDR(order?.total_idr || 0)}\nWA: ${order?.customer_whatsapp || "-"}\nStatus: ${order?.status || "pending"}`
  );
  return `https://wa.me/${digits}?text=${text}`;
}

export function notifyAdminNewOrder(order, adminPhone) {
  const title = `Order baru: ${order?.order_code || "-"}`;
  const body = `Total ${formatIDR(order?.total_idr || 0)}`;

  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification(title, { body, tag: `order-${order?.id || order?.order_code}` });
    } catch {}
  }

  return buildAdminOrderAlertUrl(adminPhone, order);
}

export async function requestAdminNotificationPermission() {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const result = await Notification.requestPermission();
    return result === "granted";
  } catch {
    return false;
  }
}