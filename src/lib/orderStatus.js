/** Shared order status labels — UI, CSV export, WA templates */

export const ORDER_STATUS_VALUES = [
  "pending",
  "paid_reported",
  "processing",
  "done",
  "cancelled",
];

export const ORDER_STATUS_LABELS = {
  pending: "Pending",
  paid_reported: "Lapor Bayar",
  processing: "Diproses",
  done: "Sukses",
  cancelled: "Dibatalkan",
};

export const ORDER_STATUS_CSV_LABELS = {
  pending: "Menunggu Pembayaran",
  paid_reported: "Lapor Bayar",
  processing: "Diproses",
  done: "Selesai",
  cancelled: "Dibatalkan",
};

export const ORDER_STATUS_OPTIONS = ORDER_STATUS_VALUES.map((value) => ({
  value,
  label: ORDER_STATUS_LABELS[value],
}));

export const LIVE_ORDER_STATUSES = new Set(["pending", "paid_reported", "processing"]);

export function prettyOrderStatus(status) {
  const key = String(status || "pending");
  return ORDER_STATUS_LABELS[key] || key;
}

export function getOrderStatusTone(status) {
  const key = String(status || "pending");
  if (key === "done") return "done";
  if (key === "processing") return "processing";
  if (key === "paid_reported") return "reported";
  if (key === "cancelled") return "cancelled";
  return "pending";
}

export function orderStatusCsvLabel(status) {
  const key = String(status || "pending");
  return ORDER_STATUS_CSV_LABELS[key] || key;
}