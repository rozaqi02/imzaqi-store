import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export function useVisitCount() {
  const [count, setCount] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.rpc("get_public_visit_count");
        if (!alive) return;
        setCount(Number(data || 0));
      } catch {
        // ignore
      }
    })();
    return () => { alive = false; };
  }, []);

  return count;
}
