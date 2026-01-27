export function getVisitorId() {
  const key = "imzaqi_visitor_id";
  let v = localStorage.getItem(key);

  const isUUID = (s) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      String(s || "")
    );

  // UUID v4 fallback (valid)
  const uuidv4 = () => {
    // prefer crypto.getRandomValues if available
    if (window.crypto?.getRandomValues) {
      const bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);

      // per RFC4122 v4
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;

      const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
        16,
        20
      )}-${hex.slice(20)}`;
    }

    // last-resort fallback (still UUID-shaped)
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  if (!isUUID(v)) {
    // if randomUUID exists, use it; else fallback uuidv4
    v = window.crypto?.randomUUID ? window.crypto.randomUUID() : uuidv4();
    localStorage.setItem(key, v);
  }

  return v;
}

// alias supaya import lama tidak error
export function getVisitorIdAsUUID() {
  return getVisitorId();
}
