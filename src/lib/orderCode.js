const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa I,O,1,0

export function makeOrderCode(len = 4) {
  let out = "";
  const n = Math.max(2, Math.min(10, Number(len) || 4));
  for (let i = 0; i < n; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `IMZ-${out}`;
}
