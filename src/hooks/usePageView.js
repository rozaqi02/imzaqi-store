import { useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { getVisitorIdAsUUID } from "../lib/visitor";

// NOTE: diekspor sebagai named + default biar kompatibel:
// - import { usePageView } from "...";
// - import usePageView from "...";
export function usePageView(pathname) {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const visitor_id = getVisitorIdAsUUID();
        const payload = {
          visitor_id,
          path: pathname || window.location.pathname,
          referrer: document.referrer || null,
          user_agent: navigator.userAgent || null,
        };

        const { error } = await supabase.from("page_views").insert(payload);

        // jangan bikin crash kalau gagal
        if (!cancelled && error) {
          console.warn("page_view insert failed:", error.message);
        }
      } catch (e) {
        if (!cancelled) console.warn("page_view error:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname]);
}

export default usePageView;
