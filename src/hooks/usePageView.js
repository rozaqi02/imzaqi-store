import { useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { getVisitorIdAsUUID } from "../lib/visitor";

const VISIT_KEY_PREFIX = "imzaqi_visit_recorded_";

function todayISO(timeZone = "Asia/Jakarta") {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
}

function getVisitKey(dayISO) {
  return `${VISIT_KEY_PREFIX}${dayISO}`;
}

function wasMarkedToday(dayISO) {
  try {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(getVisitKey(dayISO)) === "1";
  } catch {
    return false;
  }
}

function markToday(dayISO) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(getVisitKey(dayISO), "1");
  } catch {}
}

export function usePageView() {
  useEffect(() => {
    let cancelled = false;

    async function hitUniqueVisit() {
      const day = todayISO("Asia/Jakarta");
      if (wasMarkedToday(day)) return;

      try {
        const visitorId = getVisitorIdAsUUID();
        const { error } = await supabase.rpc("increment_unique_visit", {
          p_visitor_id: visitorId,
        });

        if (error) {
          // Backward compatibility jika fungsi baru belum terpasang.
          const fallback = await supabase.rpc("increment_view");
          if (fallback.error) throw fallback.error;
        }

        if (cancelled) return;
        markToday(day);
      } catch (e) {
        console.error("Gagal update unique visit", e);
      }
    }

    hitUniqueVisit();
    return () => {
      cancelled = true;
    };
  }, []);
}
