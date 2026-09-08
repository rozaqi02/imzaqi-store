const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_MIN = 2;
const CODE_MAX = 10;
const CODE_DEFAULT = 8;

export function makeOrderCode(len = CODE_DEFAULT) {
  let out = "";
  const n = Math.max(CODE_MIN, Math.min(CODE_MAX, Number(len) || CODE_DEFAULT));
  const arr = new Uint8Array(n);
  crypto.getRandomValues(arr);
  for (let i = 0; i < n; i++) {
    out += ALPHABET[arr[i] % ALPHABET.length];
  }
  return `IMZ-${out}`;
}

export function normalizeOrderCode(value) {
  const cleaned = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!cleaned) return "";
  const withoutPrefix = cleaned.startsWith("IMZ") ? cleaned.slice(3) : cleaned;
  // Empat karakter tetap diterima untuk order lama. Semua order baru memakai 8 karakter.
  if (withoutPrefix.length === 4 || (withoutPrefix.length >= 8 && withoutPrefix.length <= 10)) return `IMZ-${withoutPrefix}`;
  return cleaned;
}

export { CODE_MIN, CODE_MAX, CODE_DEFAULT };
