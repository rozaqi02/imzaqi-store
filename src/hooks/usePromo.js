import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getVisitorIdAsUUID } from "../lib/visitor";
import { mapPromoResult } from "../lib/format";

const KEY = "imzaqi_store_promo_v1";

function safeSessionStorage() {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function safeParse(json, fallback) {
  try {
    const v = JSON.parse(json);
    if (!v || typeof v !== "object") return fallback;
    const code = typeof v.code === "string" ? v.code : "";
    const percent = Number(v.percent || 0) || 0;
    return { code, percent };
  } catch {
    return fallback;
  }
}

export async function checkPromoCode(codeInput) {
  const code = String(codeInput || "").trim().toUpperCase();
  if (!code) return { ok: false, message: "Kode kosong.", percent: 0, code: "" };

  const { data, error } = await supabase.rpc("validate_promo", {
    p_code: code,
    p_visitor_id: getVisitorIdAsUUID(),
  });
  if (error) return { ok: false, message: "Gagal cek kode promo.", percent: 0, code, error: true };

  const mapped = mapPromoResult(Number(data));
  if (!mapped.ok) return { ok: false, message: mapped.message, percent: 0, code };
  return { ok: true, message: mapped.message, percent: mapped.percent, code };
}

export function usePromo() {
  // Use sessionStorage instead of localStorage so promo resets when the
  // browser tab is closed. Also clear any legacy localStorage entry.
  const [promo, setPromo] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(KEY);
      } catch {
        // ignore
      }
    }
    const storage = safeSessionStorage();
    if (!storage) return { code: "", percent: 0 };
    return safeParse(storage.getItem(KEY), { code: "", percent: 0 });
  });

  useEffect(() => {
    const storage = safeSessionStorage();
    if (!storage) return;
    try {
      storage.setItem(KEY, JSON.stringify(promo));
    } catch {
      // ignore
    }
  }, [promo]);

  const api = useMemo(() => ({
    promo,

    clear() { setPromo({ code: "", percent: 0 }); },

    async apply(codeInput) {
      const result = await checkPromoCode(codeInput);
      if (!result.ok) return result;
      setPromo({ code: result.code, percent: result.percent });

      // NOTE: promo_claims insert is NOT done here — it happens once
      // during order creation (create_order_with_stock_check RPC) in Pay.
      // Previously this caused a double-claim bug (slot decremented twice).

      return { ok: true, message: `Berhasil! Diskon ${result.percent}% diterapkan.`, percent: result.percent };
    },

    async revalidate() {
      const code = String(promo.code || "").trim();
      if (!code) return { ok: true, percent: 0, code: "" };
      const result = await checkPromoCode(code);
      if (result.ok) {
        setPromo({ code: result.code, percent: result.percent });
      } else if (!result.error) {
        setPromo({ code: "", percent: 0 });
      }
      return result;
    },
  }), [promo]);

  return api;
}
