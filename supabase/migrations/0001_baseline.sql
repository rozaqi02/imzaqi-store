-- ============================================================================
-- 0001_baseline.sql — SOURCE OF TRUTH: skema + RPC yang DIPAKAI FRONTEND
-- ----------------------------------------------------------------------------
-- ⚠️  RECONSTRUCTED. File ini merekonstruksi kontrak database dari kode
--     frontend (src/lib/api.js, src/hooks/*, src/pages/Pay.jsx, Status.jsx).
--     Signature & return shape akurat; logika internal = inferensi best-effort.
--     JANGAN menimpa fungsi yang sudah jalan di produksi tanpa membandingkan
--     dulu dengan `supabase db dump --schema public`.
--
--     Semua CREATE TABLE memakai IF NOT EXISTS -> aman dijalankan ulang dan
--     TIDAK menyentuh tabel yang sudah ada di produksi.
--     Untuk deploy baru penuh, lengkapi DDL tabel dari pg_dump produksi.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ── Katalog ────────────────────────────────────────────────────────────────
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  description text,
  price_idr integer not null default 0,
  category text,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  label text,
  price_idr integer not null default 0,
  stock integer not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists idx_variants_product on public.product_variants(product_id);

-- ── Orders ─────────────────────────────────────────────────────────────────
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  status text not null default 'pending',
  items jsonb not null default '[]'::jsonb,
  subtotal_idr integer not null default 0,
  discount_percent integer not null default 0,
  total_idr integer not null default 0,
  promo_code text,
  customer_whatsapp text,
  payment_proof_url text,
  notes text,
  admin_note text,
  visitor_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_status_check check (
    status in ('pending','paid_reported','processing','done','cancelled')
  )
);
create index if not exists idx_orders_code on public.orders(order_code);
create index if not exists idx_orders_status_created on public.orders(status, created_at desc);

-- CATATAN (C3): orders.items (jsonb) adalah SUMBER KEBENARAN yang dibaca &
-- ditulis frontend. order_items dipertahankan hanya untuk kompatibilitas
-- (deprecated) — jangan andalkan sebagai sumber data order.
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid,
  variant_id uuid,
  qty integer not null default 1,
  price_idr integer not null default 0
);

-- ── Promo ──────────────────────────────────────────────────────────────────
create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_percent integer not null default 0,
  quota integer not null default 0,
  used_count integer not null default 0,
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.promo_claims (
  id uuid primary key default gen_random_uuid(),
  promo_code text not null,
  visitor_id uuid not null,
  claimed_at timestamptz not null default now()
);

-- ── Analytics ─────────────────────────────────────────────────────────────
create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid,
  path text,
  viewed_at timestamptz not null default now()
);
create index if not exists idx_page_views_visitor_time on public.page_views(visitor_id, viewed_at desc);

create table if not exists public.daily_stats (
  stat_date date primary key,
  unique_views integer not null default 0,
  total_views integer not null default 0,
  total_orders integer not null default 0,
  revenue_idr bigint not null default 0
);

-- ── Admin & konten ─────────────────────────────────────────────────────────
-- Identitas admin mengikuti pola Supabase Auth (lihat src/lib/adminAuth.js):
-- baris admin_users.user_id merujuk auth.users.id. BUKAN password lokal.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  message text not null,
  rating integer,
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.flash_sales (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  discount_percent integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true
);

create table if not exists public.settings (
  key text primary key,
  value jsonb
);

-- Rate-limit lookup status (/status). Key = identitas requester (IP).
create table if not exists public.status_lookup_attempts (
  lookup_key text primary key,
  attempts integer not null default 0,
  window_start timestamptz not null default now()
);
-- ============================================================================
-- RPC LAYER — kontrak persis seperti dipanggil frontend
-- ============================================================================

-- 1) Checkout atomik: cek+decrement stok per varian, klaim promo sekali,
--    insert order. Mengembalikan SETOF baris order (frontend pakai data[0]).
--    order_code bentrok -> unique_violation (SQLSTATE 23505); Pay.jsx retry 5x.
create or replace function public.create_order_with_stock_check(
  p_visitor_id uuid,
  p_order_code text,
  p_items jsonb,
  p_promo_code text,
  p_subtotal_idr integer,
  p_discount_percent integer,
  p_total_idr integer,
  p_payment_proof_url text,
  p_customer_whatsapp text,
  p_notes text default null
)
returns table (order_code text, status text, id uuid)
language plpgsql security definer
as $$
declare
  it jsonb;
  v_id uuid;
  v_qty int;
  v_stock int;
begin
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_id  := nullif(it->>'variant_id', '')::uuid;
    v_qty := coalesce((it->>'qty')::int, 1);
    select stock into v_stock
      from public.product_variants where id = v_id for update;
    if v_id is null or coalesce(v_stock, 0) < v_qty then
      raise exception 'Stok tidak mencukupi untuk item %', coalesce(it->>'name', '?');
    end if;
    update public.product_variants
       set stock = stock - v_qty, updated_at = now()
     where id = v_id;
  end loop;

  if nullif(p_promo_code, '') is not null then
    insert into public.promo_claims (promo_code, visitor_id)
    select p_promo_code, p_visitor_id
     where not exists (
       select 1 from public.promo_claims
        where promo_code = p_promo_code and visitor_id = p_visitor_id);
    update public.promo_codes
       set used_count = used_count + 1
     where code = p_promo_code;
  end if;

  insert into public.orders
    (order_code, status, items, subtotal_idr, discount_percent, total_idr,
     promo_code, customer_whatsapp, payment_proof_url, notes, visitor_id)
  values
    (p_order_code, 'pending', coalesce(p_items, '[]'::jsonb), p_subtotal_idr,
     p_discount_percent, p_total_idr, nullif(p_promo_code, ''),
     p_customer_whatsapp, p_payment_proof_url, p_notes, p_visitor_id);

  return query
    select o.order_code, o.status, o.id
      from public.orders o where o.order_code = p_order_code;
end $$;

-- 2) Lookup publik SATU argumen (kontrak live Status.jsx:130).
--    SECURITY DEFINER + rate-limit per requester via status_lookup_attempts.
create or replace function public.get_order_public(p_order_code text)
returns table (
  order_code text,
  status text,
  items jsonb,
  subtotal_idr integer,
  discount_percent integer,
  total_idr integer,
  promo_code text,
  created_at timestamptz,
  admin_note text,
  notes text
)
language plpgsql security definer stable
as $$
declare
  v_key text;
  v_attempts int;
  v_window timestamptz;
begin
  v_key := coalesce(
    current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for',
    'unknown');

  select attempts, window_start into v_attempts, v_window
    from public.status_lookup_attempts where lookup_key = v_key;

  if v_window is null or v_window < now() - interval '1 minute' then
    insert into public.status_lookup_attempts (lookup_key, attempts, window_start)
    values (v_key, 1, now())
    on conflict (lookup_key) do update
       set attempts = 1, window_start = excluded.window_start;
  else
    if v_attempts >= 30 then
      raise exception 'Terlalu banyak percobaan. Coba lagi sebentar.';
    end if;
    update public.status_lookup_attempts
       set attempts = attempts + 1 where lookup_key = v_key;
  end if;

  return query
    select o.order_code, o.status, o.items, o.subtotal_idr, o.discount_percent,
           o.total_idr, o.promo_code, o.created_at, o.admin_note, o.notes
      from public.orders o where o.order_code = p_order_code;
end $$;
-- 3) Batalkan order + kembalikan stok varian + lepas slot promo (admin).
create or replace function public.cancel_order_with_stock_restore(p_order_id uuid)
returns table (order_code text, status text)
language plpgsql security definer
as $$
declare
  o public.orders%rowtype;
  it jsonb;
begin
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then
    raise exception 'Order tidak ditemukan';
  end if;
  if o.status = 'cancelled' then
    return query select o.order_code, o.status;
    return;
  end if;

  for it in select * from jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) loop
    update public.product_variants
       set stock = stock + coalesce((it->>'qty')::int, 1), updated_at = now()
     where id = nullif(it->>'variant_id', '')::uuid;
  end loop;

  if nullif(o.promo_code, '') is not null and o.visitor_id is not null then
    delete from public.promo_claims
     where promo_code = o.promo_code and visitor_id = o.visitor_id;
    update public.promo_codes
       set used_count = greatest(used_count - 1, 0)
     where code = o.promo_code;
  end if;

  update public.orders
     set status = 'cancelled', updated_at = now()
   where id = p_order_id;

  return query select x.order_code, x.status
    from public.orders x where x.id = p_order_id;
end $$;

-- 4) Validasi promo -> integer. Kode return sesuai mapPromoResult (usePromo):
--    -3 kuota habis | -2 sudah diklaim | -1 expired/belum mulai |
--     0 tidak valid  | >0 = persen diskon.
create or replace function public.validate_promo(p_code text, p_visitor_id uuid)
returns integer
language plpgsql security definer stable
as $$
declare
  p public.promo_codes%rowtype;
  claimed boolean;
begin
  select * into p from public.promo_codes
   where code = upper(btrim(coalesce(p_code, '')));
  if p.id is null or not p.is_active then return 0; end if;
  if p.expires_at is not null and p.expires_at < now() then return -1; end if;
  if p.starts_at is not null and p.starts_at > now() then return -1; end if;
  select exists(
    select 1 from public.promo_claims
     where promo_code = p.code and visitor_id = p_visitor_id) into claimed;
  if claimed then return -2; end if;
  if p.quota > 0 and p.used_count >= p.quota then return -3; end if;
  return p.discount_percent;
end $$;

-- 5) Catat kunjungan unik per visitor per hari (+ page view mentah).
create or replace function public.increment_unique_visit(p_visitor_id uuid)
returns void
language plpgsql security definer
as $$
declare
  already boolean;
begin
  select exists(
    select 1 from public.page_views
     where visitor_id = p_visitor_id
       and viewed_at >= date_trunc('day', now())) into already;

  insert into public.page_views (visitor_id, path)
  values (p_visitor_id, current_setting('request.path', true));

  insert into public.daily_stats (stat_date, unique_views, total_views)
  values (current_date, (case when already then 0 else 1 end), 1)
  on conflict (stat_date) do update
     set unique_views = daily_stats.unique_views + (case when already then 0 else 1 end),
         total_views  = daily_stats.total_views + 1;
end $$;

-- 6) Fallback tanpa argumen (usePageView.js:118).
create or replace function public.increment_view()
returns void
language plpgsql security definer
as $$
begin
  insert into public.daily_stats (stat_date, total_views)
  values (current_date, 1)
  on conflict (stat_date) do update
     set total_views = daily_stats.total_views + 1;
end $$;
-- 7) Rollup statistik publik (useLiveStats).
create or replace function public.get_public_stats()
returns jsonb
language sql security definer stable
as $$
  select jsonb_build_object(
    'total_views',       (select coalesce(sum(total_views),0) from public.daily_stats),
    'today_views',       (select coalesce(total_views,0) from public.daily_stats where stat_date = current_date),
    'last_7_days_views', (select coalesce(sum(total_views),0) from public.daily_stats where stat_date >= current_date - 6),
    'total_orders',      (select count(*)::int from public.orders),
    'today_orders',      (select count(*)::int from public.orders where created_at >= date_trunc('day', now())),
    'week_orders',       (select count(*)::int from public.orders where created_at >= date_trunc('day', now()) - interval '6 days')
  );
$$;

-- 8) Total kunjungan unik (useVisitCount).
create or replace function public.get_public_visit_count()
returns integer
language sql security definer stable
as $$
  select coalesce(sum(unique_views), 0)::int from public.daily_stats;
$$;

-- 9) Deret harian (fetchDailyStats).
create or replace function public.get_daily_stats(p_days integer default 30)
returns table (stat_date date, unique_views integer, total_orders integer, revenue_idr bigint)
language sql security definer stable
as $$
  select d.stat_date, d.unique_views, d.total_orders, d.revenue_idr
    from public.daily_stats d
   where d.stat_date >= current_date - (p_days - 1)
   order by d.stat_date;
$$;

-- 10) Statistik pengunjung (fetchVisitorStats).
create or replace function public.get_visitor_stats(p_days integer default 7)
returns jsonb
language sql security definer stable
as $$
  select jsonb_build_object(
    'total_visitors',     (select count(*)::int from (select 1 from public.page_views where viewed_at >= now() - make_interval(days => p_days) group by visitor_id) t),
    'returning_visitors', (select count(*)::int from (select 1 from public.page_views where viewed_at >= now() - make_interval(days => p_days) group by visitor_id having count(*) > 1) r),
    'new_visitors',       (select count(*)::int from (select 1 from public.page_views where viewed_at >= now() - make_interval(days => p_days) group by visitor_id having count(*) = 1) n)
  );
$$;

-- 11) Halaman terpopuler (fetchTopPages).
create or replace function public.get_top_pages(p_days integer default 7, p_limit integer default 10)
returns table (path text, view_count bigint)
language sql security definer stable
as $$
  select pv.path, count(*)::bigint as view_count
    from public.page_views pv
   where pv.viewed_at >= now() - make_interval(days => p_days)
   group by pv.path
   order by view_count desc
   limit p_limit;
$$;
-- 12) Produk terlaris (api.js:347, tanpa argumen).
create or replace function public.get_top_products()
returns table (product_id uuid, name text, sold bigint)
language sql security definer stable
as $$
  select p.id, p.name, coalesce(s.sold, 0)::bigint as sold
    from public.products p
    left join (
      select (it->>'product_id')::uuid as pid,
             sum(coalesce((it->>'qty')::int, 1)) as sold
        from public.orders o,
             jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) it
       where o.status <> 'cancelled'
       group by 1
    ) s on s.pid = p.id
   order by sold desc;
$$;

-- 13) Persen pengunjung yang kembali (fetchCohortReturn).
create or replace function public.get_cohort_return(p_days integer default 7)
returns integer
language sql security definer stable
as $$
  select coalesce(
    round(100.0 * sum(case when vc > 1 then 1 else 0 end) / nullif(count(*), 0)),
    0)::int
    from (select visitor_id, count(*) as vc
            from public.page_views
           where viewed_at >= now() - make_interval(days => p_days)
           group by visitor_id) t;
$$;

-- 14) Cek sesi admin (adminAuth / guard).
create or replace function public.is_admin()
returns boolean
language sql security definer stable
as $$
  select exists(
           select 1 from public.admin_users a where a.user_id = auth.uid()
         )
      or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

-- 15) Ringkasan funnel — PLACEHOLDER. Tabel funnel_events belum ada di
--     produksi; AdminDashboard memanggil ini via allSettled + warn sehingga
--     degrade dengan aman. Ganti body-nya setelah funnel_events dibuat.
create or replace function public.get_funnel_summary(p_days integer default 7)
returns jsonb
language sql security definer stable
as $$
  select jsonb_build_object('days', p_days, 'steps', jsonb_build_array());
$$;

-- ── Grants ────────────────────────────────────────────────────────────────
-- Publik (anon): lookup order, checkout, promo, analytics baca.
grant execute on function public.get_order_public(text) to anon, authenticated;
grant execute on function public.create_order_with_stock_check(uuid, text, jsonb, text, integer, integer, integer, text, text, text) to anon, authenticated;
grant execute on function public.validate_promo(text, uuid) to anon, authenticated;
grant execute on function public.increment_unique_visit(uuid) to anon, authenticated;
grant execute on function public.increment_view() to anon, authenticated;
grant execute on function public.get_public_stats() to anon, authenticated;
grant execute on function public.get_public_visit_count() to anon, authenticated;
grant execute on function public.get_daily_stats(integer) to anon, authenticated;
grant execute on function public.get_visitor_stats(integer) to anon, authenticated;
grant execute on function public.get_top_pages(integer, integer) to anon, authenticated;
grant execute on function public.get_top_products() to anon, authenticated;
grant execute on function public.get_cohort_return(integer) to anon, authenticated;
grant execute on function public.get_funnel_summary(integer) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
-- Operasional admin saja:
grant execute on function public.cancel_order_with_stock_restore(uuid) to authenticated;
