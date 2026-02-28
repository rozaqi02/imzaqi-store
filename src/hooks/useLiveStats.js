import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Ambil tanggal berdasarkan timezone tertentu (kebutuhan: reset statistik mengikuti WIB)
function todayISO(timeZone = "Asia/Jakarta") {
  try {
    // en-CA format: YYYY-MM-DD
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    // Fallback (kalau Intl/timeZone tidak tersedia)
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
}

function addDaysISO(isoDate, days) {
  // isoDate: YYYY-MM-DD
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function useLiveStats({ intervalMs = 15000 } = {}) {
  const [state, setState] = useState({
    totalViews: null,
    todayViews: null,
    totalOrders: null,
    todayOrders: null,
  });

  useEffect(() => {
    let alive = true;
    // WIB (Asia/Jakarta) - reset harian wajib 00:00 WIB
    const day = todayISO("Asia/Jakarta");
    const nextDay = addDaysISO(day, 1);
    const startWIB = `${day}T00:00:00+07:00`;
    const endWIB = `${nextDay}T00:00:00+07:00`;

    async function load() {
      try {
        // Prefer RPC (lebih aman kalau RLS orders/page_views ketat)
        const { data: stats, error: rpcErr } = await supabase.rpc("get_public_stats");

        if (!rpcErr && stats) {
          if (!alive) return;
          setState({
            totalViews: Number(stats.total_views || 0),
            todayViews: Number(stats.today_views || 0),
            totalOrders: Number(stats.total_orders || 0),
            todayOrders: Number(stats.today_orders || 0),
          });
          return;
        }

        // Fallback (kalau RPC belum dibuat)
        const [{ count: vToday }, { count: vTotal }, { count: oToday }, { count: oTotal }] = await Promise.all([
          supabase.from("page_views").select("id", { count: "exact", head: true }).eq("view_date", day),
          supabase.from("page_views").select("id", { count: "exact", head: true }),
          supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .gte("created_at", startWIB)
            .lt("created_at", endWIB),
          supabase.from("orders").select("id", { count: "exact", head: true }),
        ]);

        if (!alive) return;
        setState({
          totalViews: Number(vTotal || 0),
          todayViews: Number(vToday || 0),
          totalOrders: Number(oTotal || 0),
          todayOrders: Number(oToday || 0),
        });
      } catch {}
    }

    load();
    const t = setInterval(load, intervalMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [intervalMs]);

  return state;
}
