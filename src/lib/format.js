export function formatIDR(n) {
  const value = Number(n || 0);
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(value);
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

// ── Order Status Timeline ──
export function getTimeline(status) {
  const value = String(status || "pending");
  if (value === "cancelled") {
    return [
      { key: "pending", label: "Order masuk", active: true, done: true },
      { key: "cancelled", label: "Dibatalkan", active: true, done: false },
    ];
  }
  return [
    { key: "pending", label: "Order masuk", active: true, done: value !== "pending" && value !== "paid_reported" },
    {
      key: "processing",
      label: "Diproses",
      active: value === "processing" || value === "done",
      done: value === "done",
    },
    { key: "done", label: "Selesai", active: value === "done", done: value === "done" },
  ];
}

// ── Stock Classification ──
export function classifyStock(stock) {
  const s = Number(stock ?? 0);
  if (s <= 0) return "out";
  if (s <= 5) return "low";
  return "ok";
}

export function getStockWarningState(orderedQty, availableStock) {
  const qty = Number(orderedQty || 0);
  const stock = Number(availableStock ?? 0);
  if (stock === 0) return "out";
  if (stock < qty) return "insufficient";
  return "ok";
}

// ── Analytics ──
export function calcConversionRate(totalOrders, totalViews) {
  const orders = Number(totalOrders || 0);
  const views = Number(totalViews || 0);
  if (views === 0) return 0;
  return (orders / views) * 100;
}

export function formatCohortDisplay(cohortReturn, totalVisitors) {
  const ret = Number(cohortReturn || 0);
  const total = Number(totalVisitors || 0);
  if (total === 0) return { value: ret, percent: null };
  return { value: ret, percent: (ret / total) * 100 };
}

export function calcRevenueForecast(dailyStats) {
  if (!Array.isArray(dailyStats) || dailyStats.length < 7) return null;
  const n = dailyStats.length;
  const xs = dailyStats.map((_, i) => i);
  const ys = dailyStats.map((d) => Number(d.revenueIdr || 0));
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
  const sumX2 = xs.reduce((acc, x) => acc + x * x, 0);
  const denom = n * sumX2 - sumX * sumX;
  const m = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const b = (sumY - m * sumX) / n;
  let forecast7d = 0;
  for (let i = 1; i <= 7; i++) {
    forecast7d += Math.max(0, m * (n + i - 1) + b);
  }
  const trend = Math.abs(m) < 100 ? "stable" : m > 0 ? "up" : "down";
  return { forecast7d: Math.round(forecast7d), trend };
}

// ── Catalog ──
export function summarizeCatalogCopy(text) {
  const firstLine = String(text || "")
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) return "Pilih paket lalu lanjut ke checkout.";
  return firstLine.length > 58 ? `${firstLine.slice(0, 55).trimEnd()}...` : firstLine;
}

// ── Promo ──
export function mapPromoResult(rpcValue) {
  const v = Number(rpcValue);
  if (v === -3) return { ok: false, message: "Kuota kode promo sudah habis.", percent: 0 };
  if (v === -2) return { ok: false, message: "Kode promo sudah kedaluwarsa.", percent: 0 };
  if (v === -1) return { ok: false, message: "Terlalu banyak percobaan. Coba lagi dalam 1 jam.", percent: 0 };
  if (v === 0)  return { ok: false, message: "Kode tidak valid atau tidak aktif.", percent: 0 };
  if (v > 0)   return { ok: true, message: `Berhasil! Diskon ${v}% diterapkan.`, percent: v };
  return { ok: false, message: "Kode tidak valid.", percent: 0 };
}

export function calcRemainingQuota(promo) {
  if (promo?.max_uses == null) return null;
  return Math.max(0, Number(promo.max_uses) - Number(promo.used_count || 0));
}

export function isPromoExpired(promo) {
  if (!promo?.expired_at) return false;
  return new Date(promo.expired_at) < new Date();
}

const ACCOUNT_TYPE_KEYWORDS = [
  { keyword: "private", label: "Private", color: "var(--accent, #00d6b4)" },
  { keyword: "sharing", label: "Sharing", color: "#5b8def" },
  { keyword: "family", label: "Family", color: "#a855f7" },
  { keyword: "premium", label: "Premium", color: "#f59e0b" },
  { keyword: "student", label: "Student", color: "#10b981" },
  { keyword: "basic", label: "Basic", color: "#94a3b8" },
];

export function detectAccountTypes(variants) {
  const found = [];
  if (!variants || !variants.length) return found;
  ACCOUNT_TYPE_KEYWORDS.forEach(({ keyword, label, color }) => {
    if ((variants || []).some((v) => String(v?.name || "").toLowerCase().includes(keyword))) {
      found.push({ label, color });
    }
  });
  return found;
}
