-- ============================================================================
-- 0002_funnel_objects.sql
-- Objek analitik funnel yang DIPANGGIL frontend tapi BELUM ADA di produksi.
-- ----------------------------------------------------------------------------
-- AMAN & ADITIF. Migration ini HANYA membuat:
--   1. public.funnel_events      (tabel event funnel)
--   2. public.get_funnel_summary (agregasi funnel utk Admin > Analytics)
--
-- Migration ini SENGAJA TIDAK:
--   - menyentuh / me-REVOKE get_order_public(text)  -> halaman /status tetap hidup
--   - membuat get_order_public_secure / get_order_public_by_code (tidak dipakai kode)
--   - membuat restock_requests / status_lookup_attempts (tidak dipakai kode)
--   - menambah kolom ke orders / testimonials
-- Bagian berbahaya itu hanya ada di _archived/20260909_secure_checkout_funnel.sql.
--
-- Kontrak kode yang dipenuhi file ini:
--   src/lib/funnelAnalytics.js      -> INSERT funnel_events
--   src/pages/admin/AdminDashboard  -> rpc get_funnel_summary(p_days)
--
-- CHECK event_name di bawah DISINKRONKAN dengan event yang benar-benar dikirim
-- frontend. Versi terarsip menolak 'buy_now', 'apply_promo', 'restock_request'
-- sehingga 3 dari 7 event akan selalu gagal INSERT.
-- ============================================================================

create extension if not exists pgcrypto;

-- Prasyarat: is_admin() harus sudah ada (dibuat di 0001_baseline.sql).
do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_admin'
  ) then
    raise exception 'public.is_admin() tidak ditemukan. Jalankan 0001_baseline.sql lebih dulu.';
  end if;
end $$;

create table if not exists public.funnel_events (
  id bigint generated always as identity primary key,
  visitor_id uuid,
  session_id uuid not null,
  event_name text not null check (event_name in (
    'view_product',      -- ProductDetail.jsx
    'add_to_cart',       -- ProductDetail.jsx
    'buy_now',           -- ProductDetail.jsx
    'begin_checkout',    -- Checkout.jsx
    'apply_promo',       -- Pay.jsx
    'restock_request',   -- ProductDetail.jsx (notify-me)
    'qris_opened',       -- cadangan, dipakai get_funnel_summary
    'manual_selected',   -- cadangan
    'payment_failed',    -- cadangan
    'payment_reported',  -- cadangan
    'order_completed'    -- Status.jsx
  )),
  path text,
  product_id uuid,
  variant_id uuid,
  order_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists funnel_events_created_at_idx on public.funnel_events(created_at desc);
create index if not exists funnel_events_session_idx on public.funnel_events(session_id, created_at desc);
create index if not exists funnel_events_event_name_idx on public.funnel_events(event_name, created_at desc);

alter table public.funnel_events enable row level security;

-- Publik boleh INSERT (write-only). Tidak ada SELECT untuk anon:
-- data funnel hanya dibaca admin lewat get_funnel_summary (SECURITY DEFINER).
drop policy if exists funnel_events_insert on public.funnel_events;
create policy funnel_events_insert on public.funnel_events
  for insert to anon, authenticated
  with check (true);

-- ============================================================================
-- get_funnel_summary(p_days) -> jsonb { days, steps: [{event_name, sessions, rate_from_previous}] }
-- Bentuk return persis seperti yang dikonsumsi AdminDashboard.jsx:2929-2938.
-- ============================================================================
create or replace function public.get_funnel_summary(p_days integer default 7)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days, 7), 90));
  v_start timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 7), 90)));
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  with ordered(event_name, step_order) as (
    values
      ('view_product', 1),
      ('add_to_cart', 2),
      ('buy_now', 3),
      ('begin_checkout', 4),
      ('qris_opened', 5),
      ('manual_selected', 6),
      ('payment_reported', 7),
      ('order_completed', 8)
  ),
  counts as (
    select o.step_order,
           o.event_name,
           count(distinct fe.session_id)::bigint as sessions
    from ordered o
    left join public.funnel_events fe
      on fe.event_name = o.event_name
     and fe.created_at >= v_start
    group by o.step_order, o.event_name
  ),
  rated as (
    select step_order,
           event_name,
           sessions,
           lag(sessions) over (order by step_order) as prev_sessions
    from counts
  )
  select jsonb_build_object(
    'days', v_days,
    'steps', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'event_name', event_name,
          'sessions', sessions,
          'rate_from_previous',
            case
              when prev_sessions is null or prev_sessions = 0 then 0
              else round((sessions::numeric / prev_sessions::numeric) * 100, 1)
            end
        ) order by step_order
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from rated;

  return v_result;
end;
$$;

grant execute on function public.get_funnel_summary(integer) to authenticated;
grant insert on public.funnel_events to anon, authenticated;
