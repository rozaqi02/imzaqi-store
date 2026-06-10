-- Hero stats: total orders + kunjungan (unique views) 7 hari terakhir (WIB)
-- Jalankan di Supabase SQL Editor jika angka kunjungan 7 hari belum muncul di frontend.

CREATE OR REPLACE FUNCTION public.get_public_stats()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_views bigint := 0;
  v_today_views bigint := 0;
  v_total_orders bigint := 0;
  v_today_orders bigint := 0;
  v_week_orders bigint := 0;
  v_last_7_days_views bigint := 0;
  v_day date := (timezone('Asia/Jakarta', now()))::date;
  v_day_start timestamptz := (v_day::text || ' 00:00:00+07')::timestamptz;
  v_next_day timestamptz := v_day_start + interval '1 day';
  v_week_start date := v_day - 6;
BEGIN
  SELECT COALESCE(total_views, 0), COALESCE(today_views, 0)
  INTO v_total_views, v_today_views
  FROM site_stats
  LIMIT 1;

  SELECT COUNT(*)::bigint INTO v_total_orders FROM orders;
  SELECT COUNT(*)::bigint INTO v_today_orders
  FROM orders
  WHERE created_at >= v_day_start AND created_at < v_next_day;

  SELECT COUNT(*)::bigint INTO v_week_orders
  FROM orders
  WHERE created_at >= (v_week_start::text || ' 00:00:00+07')::timestamptz
    AND created_at < v_next_day;

  SELECT COALESCE(SUM(unique_views), 0)::bigint INTO v_last_7_days_views
  FROM daily_stats
  WHERE stat_date >= v_week_start AND stat_date <= v_day;

  RETURN json_build_object(
    'total_views', v_total_views,
    'today_views', v_today_views,
    'total_orders', v_total_orders,
    'today_orders', v_today_orders,
    'week_orders', v_week_orders,
    'last_7_days_views', v_last_7_days_views
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_stats() TO anon, authenticated;

-- Opsional: izinkan frontend menjumlahkan langsung dari daily_stats
DO $$
BEGIN
  IF to_regprocedure('public.get_daily_stats(integer)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.get_daily_stats(integer) TO anon, authenticated;
  END IF;
END;
$$;