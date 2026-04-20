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

function startOfWeekISO(isoDate) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const dayOfWeek = d.getUTCDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d.toISOString().slice(0, 10);
}

function getLoadProfile(baseIntervalMs) {
  try {
    const coarse = typeof window !== "undefined" && window.matchMedia?.("(max-width: 720px), (pointer: coarse)")?.matches;
    const saveData = Boolean(navigator?.connection?.saveData);
    const lowMemory = Number(navigator?.deviceMemory || 0) > 0 && Number(navigator.deviceMemory) <= 4;

    if (coarse || saveData || lowMemory) {
      return { intervalMs: Math.max(baseIntervalMs, 45000), lightMode: true };
    }
  } catch {}

  return { intervalMs: baseIntervalMs, lightMode: false };
}

export function useLiveStats({ intervalMs = 15000 } = {}) {
  const [state, setState] = useState({
    totalViews: null,
    todayViews: null,
    totalOrders: null,
    todayOrders: null,
    weekOrders: null,
  });

  useEffect(() => {
    let alive = true;
    const { intervalMs: effectiveIntervalMs } = getLoadProfile(intervalMs);
    let timerId = 0;

    async function load() {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      const day = todayISO("Asia/Jakarta");
      const nextDay = addDaysISO(day, 1);
      const weekStart = startOfWeekISO(day);
      const startWIB = `${day}T00:00:00+07:00`;
      const endWIB = `${nextDay}T00:00:00+07:00`;
      const weekStartWIB = `${weekStart}T00:00:00+07:00`;

      try {
        // Prefer RPC (lebih aman kalau RLS orders/page_views ketat)
        const [
          { data: stats, error: rpcErr },
          { count: oWeek },
        ] = await Promise.all([
          supabase.rpc("get_public_stats"),
          supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .gte("created_at", weekStartWIB)
            .lt("created_at", endWIB),
        ]);

        if (!rpcErr && stats) {
          if (!alive) return;
          setState({
            totalViews: Number(stats.total_views || 0),
            todayViews: Number(stats.today_views || 0),
            totalOrders: Number(stats.total_orders || 0),
            todayOrders: Number(stats.today_orders || 0),
            weekOrders: Number(stats.week_orders ?? oWeek ?? 0),
          });
          return;
        }

        // Fallback (kalau RPC belum tersedia): ambil view dari site_stats.
        const [{ data: siteStats }, { count: oToday }, { count: oTotal }, { count: oWeekFallback }] = await Promise.all([
          supabase.from("site_stats").select("total_views,today_views,last_date").maybeSingle(),
          supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .gte("created_at", startWIB)
            .lt("created_at", endWIB),
          supabase.from("orders").select("id", { count: "exact", head: true }),
          supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .gte("created_at", weekStartWIB)
            .lt("created_at", endWIB),
        ]);

        if (!alive) return;
        setState({
          totalViews: Number(siteStats?.total_views || 0),
          todayViews: Number(siteStats?.today_views || 0),
          totalOrders: Number(oTotal || 0),
          todayOrders: Number(oToday || 0),
          weekOrders: Number(oWeekFallback || 0),
        });
      } catch {}
    }

    function startPolling() {
      load();
      timerId = window.setInterval(load, effectiveIntervalMs);
    }

    function onVisibilityChange() {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        load();
      }
    }

    startPolling();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    return () => {
      alive = false;
      window.clearInterval(timerId);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
  }, [intervalMs]);

  return state;
}
