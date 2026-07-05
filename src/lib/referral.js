const REF_KEY = "imzaqi_ref_v1";

export function captureReferralFromUrl(search = "") {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(search || window.location.search);
    const ref = String(params.get("ref") || "").trim().slice(0, 64);
    if (!ref) return getReferralCode();
    localStorage.setItem(REF_KEY, ref);
    return ref;
  } catch {
    return null;
  }
}

export function getReferralCode() {
  try {
    return localStorage.getItem(REF_KEY) || "";
  } catch {
    return "";
  }
}
