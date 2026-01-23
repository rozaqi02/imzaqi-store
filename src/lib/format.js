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
