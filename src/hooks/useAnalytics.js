import { useEffect, useState } from "react";
import { fetchDailyStats, fetchVisitorStats, fetchTopPages } from "../lib/api";

const DEFAULT_DAILY = [];
const DEFAULT_VISITOR = { totalVisitors: 0, returningVisitors: 0, newVisitors: 0 };
const DEFAULT_PAGES = [];

export function useAnalytics({ days = 30 } = {}) {
  const [dailyStats, setDailyStats] = useState(DEFAULT_DAILY);
  const [visitorStats, setVisitorStats] = useState(DEFAULT_VISITOR);
  const [topPages, setTopPages] = useState(DEFAULT_PAGES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchDailyStats({ days }),
      fetchVisitorStats({ days }),
      fetchTopPages({ days, limit: 10 }),
    ])
      .then(([daily, visitor, pages]) => {
        if (!alive) return;
        setDailyStats(daily);
        setVisitorStats(visitor);
        setTopPages(pages);
      })
      .catch((err) => {
        if (!alive) return;
        console.warn("useAnalytics: gagal memuat data", err);
        setError(err?.message || String(err));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [days]);

  return { dailyStats, visitorStats, topPages, loading, error };
}
