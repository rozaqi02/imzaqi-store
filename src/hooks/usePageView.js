import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
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
  const location = useLocation();
  const lastTrackedPath = useRef(null);
  const internalReferrer = useRef(
    typeof document !== "undefined" ? document.referrer : null
  );

  // Track setiap navigasi ke tabel page_views — hanya saat pathname berubah
  useEffect(() => {
    let cancelled = false;

    async function trackView() {
      const path = location.pathname;
      
      // Cegah duplicate tracking (misal karena React Strict Mode re-render)
      if (lastTrackedPath.current === path) return;
      
      const currentReferrer = internalReferrer.current;
      
      // Update state untuk navigasi berikutnya
      lastTrackedPath.current = path;
      internalReferrer.current = path; // Jadikan path saat ini sebagai referrer untuk halaman selanjutnya

      const visitorId = getVisitorIdAsUUID();

      // Fire-and-forget: tidak perlu return value, tidak crash kalau gagal.
      // Catatan: error 403 di Network tab tidak bisa disembunyikan dari kode —
      // itu log level browser bukan JS. Fix permanen ada di RLS Supabase.
      supabase
        .from("page_views")
        .insert({ visitor_id: visitorId, path, referrer: currentReferrer || null })
        .then(({ error }) => {
          // Abaikan error permission/network saat tracking — bukan error kritis
          if (error && error.code !== '42501' && error.status !== 403) {
            // Hanya log error yang tidak terduga (bukan permission denied)
            console.debug("[pageView] insert non-critical error:", error.code);
          }
        })
        .catch(() => { /* network error, abaikan */ });
    }

    if (!cancelled) trackView();
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  // Increment unique visit counter (site_stats) — sekali per hari
  useEffect(() => {
    async function hitUniqueVisit() {
      const day = todayISO("Asia/Jakarta");
      if (wasMarkedToday(day)) return;

      // Tandai SEBELUM request async untuk mencegah double-hit dari React Strict Mode
      markToday(day);

      try {
        const visitorId = getVisitorIdAsUUID();
        const { error } = await supabase.rpc("increment_unique_visit", {
          p_visitor_id: visitorId,
        });

        if (error) {
          const fallback = await supabase.rpc("increment_view");
          if (fallback.error) throw fallback.error;
        }

      } catch (e) {
        console.error("Gagal update unique visit", e);
      }
    }

    hitUniqueVisit();
  }, []);
}
