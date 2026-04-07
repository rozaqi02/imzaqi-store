import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";

export function usePageView(path) {
  // Simpan path terakhir agar route baru tetap tercatat,
  // tapi render ulang / StrictMode tidak memicu double-hit untuk path yang sama.
  const lastTrackedPath = useRef("");

  useEffect(() => {
    const nextPath = String(path || "/");
    if (lastTrackedPath.current === nextPath) return;
    lastTrackedPath.current = nextPath;
    
    async function hit() {
      try {
        await supabase.rpc("increment_view");
      } catch (e) {
        console.error("Gagal update view", e);
      }
    }

    hit();
  }, [path]);
}
