import React from "react";
import { formatIDR } from "../../lib/format";
import { getOrderStatusTone, prettyOrderStatus } from "../../lib/orderStatus";

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