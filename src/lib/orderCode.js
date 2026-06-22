const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_MIN = 2;
const CODE_MAX = 10;
const CODE_DEFAULT = 4;

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

export { CODE_MIN, CODE_MAX, CODE_DEFAULT };
