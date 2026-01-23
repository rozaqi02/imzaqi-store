export function getVisitorId() {
  const key = "imzaqi_visitor_id";
  let v = localStorage.getItem(key);

  if (!v) {
    if (window.crypto && window.crypto.randomUUID) {
      v = window.crypto.randomUUID();
    } else {
      v = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
    localStorage.setItem(key, v);
  }
  return v;
}

// alias supaya import lama tidak error
export function getVisitorIdAsUUID() {
  return getVisitorId();
}
