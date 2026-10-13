/** Shared order status labels — UI, CSV export, WA templates */

/**
 * KOSAKATA STATUS — REKONSILIASI (lihat supabase/migrations/0001_baseline.sql)
 * ---------------------------------------------------------------------------
 * CANONICAL (diproduksi & di CHECK constraint baseline):
 *   pending | paid_reported | processing | done | cancelled
 *
 * LEGACY / DEFENSIVE (masih diterima UI agar tidak crash, tetapi TIDAK
 * dihasilkan oleh alur checkout aktif):
 *   pending_payment | expired
 *   -> Keduanya HANYA berasal dari redesign "secure checkout" yang
 *      DITINGGALKAN (supabase/migrations/_archived/20260909). File itu sudah
 *      diarsipkan dan TIDAK boleh diterapkan, jadi jangan menambah logika baru
 *      yang bergantung pada pending_payment/expired.
 *
 * Aturan: tulis kode baru hanya untuk 5 status CANONICAL. Label untuk 2 status
 * legacy dipertahankan murni untuk backward-compat data lama.
 */
export const ORDER_STATUS_VALUES = [
  "pending_payment",
  "pending",
  "paid_reported",
  "processing",
  "done",
  "cancelled",
  "expired",
];

export const ORDER_STATUS_LABELS = {
  pending: "Pending",
  pending_payment: "Menunggu Bayar",
  paid_reported: "Lapor Bayar",
  processing: "Diproses",
  done: "Sukses",
  cancelled: "Dibatalkan",
  expired: "Kedaluwarsa",
};

export const ORDER_STATUS_CSV_LABELS = {
  pending: "Menunggu Pembayaran",
  pending_payment: "Menunggu Pembayaran",
  paid_reported: "Lapor Bayar",
  processing: "Diproses",
  done: "Selesai",
  cancelled: "Dibatalkan",
  expired: "Kedaluwarsa",
};

export const ORDER_STATUS_OPTIONS = ORDER_STATUS_VALUES.map((value) => ({
  value,
  label: ORDER_STATUS_LABELS[value],
}));

export const LIVE_ORDER_STATUSES = new Set(["pending", "pending_payment", "paid_reported", "processing"]);

export function prettyOrderStatus(status) {
  const key = String(status || "pending");
  return ORDER_STATUS_LABELS[key] || key;
}

export function getOrderStatusTone(status) {
  const key = String(status || "pending");
  if (key === "done") return "done";
  if (key === "processing") return "processing";
  if (key === "paid_reported") return "reported";
  if (key === "cancelled" || key === "expired") return "cancelled";
  return "pending";
}

export function orderStatusCsvLabel(status) {
  const key = String(status || "pending");
  return ORDER_STATUS_CSV_LABELS[key] || key;
}
