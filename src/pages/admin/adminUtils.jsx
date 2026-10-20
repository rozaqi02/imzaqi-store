import React from "react";
import { formatIDR } from "../../lib/format";
import { getOrderStatusTone, prettyOrderStatus } from "../../lib/orderStatus";

export function toLocalDatetimeInput(dateValue) {
  if (!dateValue) return "";
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export const CATEGORY_OPTIONS = [
  { value: "streaming", label: "Streaming" },
  { value: "music", label: "Music" },
  { value: "tools", label: "Tools" },
  { value: "ai", label: "AI" },
  { value: "design", label: "Design" },
  { value: "learning", label: "Belajar" },
  { value: "academic", label: "Jasa Akademik" },
  { value: "other", label: "Lainnya" },
];

export const CATEGORY_LABELS = CATEGORY_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

export function getSafeOrderItems(order) {
  return Array.isArray(order?.items) ? order.items : [];
}

export function StatusBadge({ status }) {
  return (
    <span className={"admin-status " + getOrderStatusTone(status)}>
      {prettyOrderStatus(status)}
    </span>
  );
}

export function getOrderItemCount(order) {
  return getSafeOrderItems(order).reduce((sum, item) => sum + Number(item?.qty || 0), 0);
}

export function getOrderDiscountAmount(order) {
  const subtotal = Number(order?.subtotal_idr || 0);
  const total = Number(order?.total_idr || 0);
  return Math.max(0, subtotal - total);
}

export function prettyCategory(category) {
  return CATEGORY_LABELS[String(category || "other").toLowerCase()] || CATEGORY_LABELS.other;
}

export function formatCompactNumber(value) {
  return new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value || 0));
}

export function formatCompactIDR(value) {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 1000000) {
    return `Rp${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(amount / 1000000)} jt`;
  }
  if (Math.abs(amount) >= 1000) {
    return `Rp${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(amount / 1000)} rb`;
  }
  return formatIDR(amount);
}

export function formatPercent(value, digits = 0) {
  return `${Number(value || 0).toFixed(digits)}%`;
}

export function formatAdminDate(value) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Waktu order lengkap - tanggal + jam:menit:detik WIB */
export function formatAdminDateTime(value) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatOrderItemSummary(item) {
  const name = String(item?.product_name || "Produk").trim();
  const variant = String(item?.variant_name || "").trim();
  const duration = String(item?.duration_label || "").trim();
  const details = [variant, duration].filter(Boolean).join(" · ");
  const qty = Number(item?.qty || 1);
  return details ? `${name} - ${details} (×${qty})` : `${name} (×${qty})`;
}

export function formatDayLabel(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
  }).format(date);
}

export function toDateKeyWIB(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function normalizeWhatsApp(value) {
  const raw = String(value || "").replace(/\D/g, "");
  if (!raw) return "";
  if (raw.startsWith("62")) return raw;
  if (raw.startsWith("0")) return `62${raw.slice(1)}`;
  return raw;
}

export function buildWhatsAppLink(number) {
  const digits = normalizeWhatsApp(number);
  return digits ? `https://wa.me/${digits}` : "";
}

export const WHATSAPP_ACTION_TEMPLATES = [
  { id: "credentials", label: "🔑 Kirim Akun Ready", desc: "Kirim detail akun & status ke buyer" },
  { id: "processing", label: "⚡ Sedang Diproses", desc: "Konfirmasi pembayaran diterima" },
  { id: "payment_reminder", label: "💰 Tagihan Pembayaran", desc: "Follow up order yang belum dibayar" },
  { id: "review_request", label: "⭐ Minta Review / Rating", desc: "Ajak buyer beri ulasan di status" },
  { id: "chat", label: "💬 Chat Langsung", desc: "Chat WhatsApp umum dengan ID order" },
];

export function buildWhatsAppMessage({ order, type = "chat", customNote = "" }) {
  const orderCode = order?.order_code || order?.id || "-";
  const total = formatIDR(order?.total_idr || 0);
  const items = getSafeOrderItems(order);
  const itemsSummary = items.length
    ? items.map(formatOrderItemSummary).join("\n- ")
    : "-";
  const note = String(customNote || order?.admin_note || "").trim();
  const origin = typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : "https://imzaqistore.com";
  const statusUrl = `${origin}/status?order=${encodeURIComponent(orderCode)}`;

  switch (type) {
    case "credentials":
    case "account_ready":
      return (
        `Halo kak! Akun pesanan kamu sudah siap digunakan 🎉\n\n` +
        `📦 Detail Order:\n- ID: ${orderCode}\n- Paket:\n- ${itemsSummary}\n\n` +
        `🔑 Detail Akun / Kredensial:\n${note ? note : "Silakan cek langsung di link status pesanan kamu."}\n\n` +
        `🔗 Cek Status & Info Garansi:\n${statusUrl}\n\n` +
        `Jika ada kendala login atau pertanyaan seputar akun, silakan balas chat ini ya kak. Terima kasih sudah belanja di Imzaqi Store! ✨`
      );
    case "processing":
      return (
        `Halo kak! Pembayaran untuk pesanan kamu sudah kami terima dan sedang diproses 👍\n\n` +
        `📦 Detail Order:\n- ID: ${orderCode}\n- Paket:\n- ${itemsSummary}\n- Total: ${total}\n\n` +
        `🔗 Lacak Status Pesanan:\n${statusUrl}\n\n` +
        `Mohon ditunggu sebentar ya kak, kredensial/akun pesanan kamu sedang disiapkan admin.`
      );
    case "payment_reminder":
      return (
        `Halo kak! Mengingatkan pesanan kamu di Imzaqi Store masih menunggu pembayaran:\n\n` +
        `📦 Detail Order:\n- ID: ${orderCode}\n- Paket:\n- ${itemsSummary}\n- Total Tagihan: ${total}\n\n` +
        `🔗 Lanjutkan Pembayaran & Konfirmasi:\n${statusUrl}\n\n` +
        `Silakan transfer dan upload bukti bayar di link tersebut agar pesanan langsung kami proses. Butuh bantuan? Balas chat ini ya kak!`
      );
    case "review_request":
    case "completed":
      return (
        `Halo kak, pesanan ${orderCode} sudah selesai kami kirimkan! 🎉\n\n` +
        `Semoga layanannya memuaskan ya kak. Kami akan sangat berterima kasih jika kakak berkenan meluangkan 1 menit untuk memberi rating & ulasan di link ini:\n` +
        `🔗 ${statusUrl}\n\n` +
        `Terima kasih banyak atas kepercayaannya pada Imzaqi Store! 🙏`
      );
    case "chat":
    default:
      return `Halo kak! Perihal pesanan dengan ID ${orderCode} di Imzaqi Store...`;
  }
}

export function buildWhatsAppActionLink(order, type = "chat", customNote = "") {
  const digits = normalizeWhatsApp(order?.customer_whatsapp || "");
  if (!digits) return "";
  const msg = buildWhatsAppMessage({ order, type, customNote });
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
}