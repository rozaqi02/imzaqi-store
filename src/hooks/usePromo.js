import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getVisitorIdAsUUID } from "../lib/visitor";

const KEY = "imzaqi_store_promo_v1";

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

export function usePromo() {
  const [promo, setPromo] = useState(() => safeParse(localStorage.getItem(KEY), { code: "", percent: 0 }));

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(promo));
  }, [promo]);

  const api = useMemo(() => ({
    promo,

    clear() { setPromo({ code: "", percent: 0 }); },

    async apply(codeInput) {
      const code = String(codeInput || "").trim().toUpperCase();
      if (!code) return { ok: false, message: "Kode kosong." };

      const { data, error } = await supabase.rpc("validate_promo", { p_code: code });
      if (error) return { ok: false, message: "Gagal cek kode promo." };

      const percent = Number(data || 0);
      if (!percent) return { ok: false, message: "Kode tidak valid atau tidak aktif." };

      setPromo({ code, percent });

      // Optional: record claim (idempotent by unique constraint)
      try {
        const visitor_id = getVisitorIdAsUUID();
        await supabase.from("promo_claims").insert({ visitor_id, code });
      } catch {
        // ignore
      }

      return { ok: true, message: `Berhasil! Diskon ${percent}% diterapkan.` };
    },
  }), [promo]);

  return api;
}
