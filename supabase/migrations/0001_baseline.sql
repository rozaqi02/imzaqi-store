-- ============================================================================
-- 0001_baseline.sql — SKEMA LENGKAP & RPC PRODUKSI IMZAQI STORE
-- ----------------------------------------------------------------------------
-- Skema tabel disinkronkan 100% dengan database produksi live (17 tabel).
-- Semua fungsi menggunakan CREATE OR REPLACE FUNCTION dengan SECURITY DEFINER
-- untuk isolasi hak akses publik (anon) dan admin (authenticated).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ── 1. Admin Users ───────────────────────────────────────────────────────────
create table if not exists public.admin_users (
  user_id uuid not null primary key references auth.users(id) on delete cascade,
  email text unique,
  created_at timestamptz not null default now()
);

-- ── 2. Produk ────────────────────────────────────────────────────────────────
create table if not exists public.products (
  id uuid not null default gen_random_uuid() primary key,
  slug text not null unique,
  name text not null,
  description text,
  icon_url text,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  category text not null default 'other'::text check (
    category is null or category in ('streaming', 'music', 'tools', 'ai', 'design', 'learning', 'academic', 'other')
  )
);
create index if not exists idx_products_active_sort on public.products(is_active, sort_order);

-- ── 3. Varian Produk ─────────────────────────────────────────────────────────
create table if not exists public.product_variants (
  id uuid not null default gen_random_uuid() primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  duration_label text not null,
  price_idr integer not null,
  guarantee_text text,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  stock integer not null default 0,
  sold_count integer not null default 0,
  description text,
  requires_buyer_email boolean not null default false
);
create index if not exists idx_variants_product on public.product_variants(product_id);
create index if not exists idx_variants_active_sort on public.product_variants(is_active, sort_order);

-- ── 4. Pengaturan Situs (Site Settings) ───────────────────────────────────────
create table if not exists public.site_settings (
  key text not null primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ── 5. Kode Promo ────────────────────────────────────────────────────────────
create table if not exists public.promo_codes (
  code text not null primary key,
  percent integer not null check (percent >= 1 and percent <= 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expired_at timestamptz,
  max_uses integer,
  used_count integer default 0
);

-- ── 6. Testimoni Pelanggan ───────────────────────────────────────────────────
create table if not exists public.testimonials (
  id uuid not null default gen_random_uuid() primary key,
  image_url text not null,
  caption text,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);
create index if not exists idx_testimonials_active_sort on public.testimonials(is_active, sort_order);

-- ── 7. Klaim Promo (Promo Claims) ───────────────────────────────────────────
create table if not exists public.promo_claims (
  id uuid not null default gen_random_uuid() primary key,
  visitor_id uuid not null,
  code text not null references public.promo_codes(code) on delete cascade,
  claimed_at timestamptz not null default now()
);
create index if not exists idx_promo_claims_code on public.promo_claims(code);
create index if not exists idx_promo_claims_visitor on public.promo_claims(visitor_id);

-- ── 8. Pesanan (Orders) ─────────────────────────────────────────────────────
create table if not exists public.orders (
  id uuid not null default gen_random_uuid() primary key,
  visitor_id uuid not null,
  items jsonb not null,
  subtotal_idr integer not null,
  discount_percent integer not null default 0,
  total_idr integer not null,
  status text not null default 'pending'::text,
  created_at timestamptz not null default now(),
  order_code text unique,
  promo_code text,
  payment_proof_url text,
  customer_whatsapp text,
  notes text,
  admin_note text,
  reservation_expires_at timestamptz,
  payment_reported_at timestamptz,
  payment_reference text,
  verification_status text not null default 'unverified'::text,
  inventory_committed_at timestamptz,
  buyer_email text,
  inventory_released_at timestamptz,
  checkout_version integer,
  late_payment_report boolean not null default false
);
create index if not exists idx_orders_code on public.orders(order_code);
create index if not exists idx_orders_status_created on public.orders(status, created_at desc);
create index if not exists idx_orders_buyer_email on public.orders(buyer_email) where buyer_email is not null;

-- ── 9. Relasional Order Items (Normalisasi/Pelengkap) ────────────────────────
create table if not exists public.order_items (
  id uuid not null default gen_random_uuid() primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null default ''::text,
  variant_name text not null default ''::text,
  duration_label text,
  price_idr integer not null default 0,
  qty integer not null default 1,
  product_icon_url text,
  description text,
  guarantee_text text,
  requires_buyer_email boolean default false,
  created_at timestamptz default now()
);
create index if not exists idx_order_items_order on public.order_items(order_id);

-- ── 10. Statistik Keseluruhan (Site Stats Counter) ───────────────────────────
create table if not exists public.site_stats (
  id integer not null default 1 primary key,
  total_views bigint default 0,
  today_views integer default 0,
  last_date date default current_date
);

-- ── 11. Pengunjung Harian (Daily Visitors) ──────────────────────────────────
create table if not exists public.daily_visitors (
  id bigint generated by default as identity primary key,
  visit_date date not null,
  visitor_id uuid not null,
  first_seen_at timestamptz not null default now()
);
create index if not exists idx_daily_visitors_date on public.daily_visitors(visit_date, visitor_id);

-- ── 12. Statistik Harian (Daily Stats) ───────────────────────────────────────
create table if not exists public.daily_stats (
  date date not null primary key,
  unique_views integer default 0,
  total_orders integer default 0,
  revenue_idr bigint default 0,
  new_visitors integer default 0,
  returning_visitors integer default 0
);

-- ── 13. Page Views ──────────────────────────────────────────────────────────
create table if not exists public.page_views (
  id uuid not null default gen_random_uuid() primary key,
  visitor_id uuid not null,
  path text,
  referrer text,
  visited_at timestamptz default now()
);
create index if not exists idx_page_views_visited_at on public.page_views(visited_at desc);
create index if not exists idx_page_views_visitor_visited on public.page_views(visitor_id, visited_at desc);

-- ── 14. Percobaan Promo (Promo Attempts Rate Limiting) ──────────────────────
create table if not exists public.promo_attempts (
  id bigint generated by default as identity primary key,
  visitor_id uuid not null,
  attempted_at timestamptz not null default now()
);
create index if not exists idx_promo_attempts_visitor on public.promo_attempts(visitor_id, attempted_at desc);

-- ── 15. Flash Sales ─────────────────────────────────────────────────────────
create table if not exists public.flash_sales (
  id uuid not null default gen_random_uuid() primary key,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  discount_percent integer not null check (discount_percent >= 1 and discount_percent <= 99),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean default true,
  created_at timestamptz default now()
);
create index if not exists idx_flash_sales_active_dates on public.flash_sales(is_active, starts_at, ends_at);

-- ── 16. Checkout Access Protection ──────────────────────────────────────────
create table if not exists public.checkout_access (
  order_id uuid not null primary key references public.orders(id) on delete cascade,
  token_hash text not null unique,
  request_hash text not null,
  created_at timestamptz not null default now()
);

-- ── 17. Checkout Promo Slots ────────────────────────────────────────────────
create table if not exists public.checkout_promo_slots (
  order_id uuid not null primary key references public.orders(id) on delete cascade,
  code text not null references public.promo_codes(code) on delete cascade,
  state text not null check (state in ('reserved', 'consumed', 'released'))
);

-- ── 18. Checkout Rate Buckets ───────────────────────────────────────────────
create table if not exists public.checkout_rate_buckets (
  identity text not null primary key,
  window_start timestamptz not null,
  attempts integer not null
);

-- ============================================================================
-- RPC FUNCTIONS
-- ============================================================================

-- 1) Checkout atomik: cek+decrement stok per varian, update sold_count, klaim promo,
--    dan buat pesanan lengkap dengan buyer_email (bila ada).
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
  p_notes text default null,
  p_buyer_email text default null
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
    if v_id is not null then
      select stock into v_stock
        from public.product_variants where id = v_id for update;
      if coalesce(v_stock, 0) < v_qty then
        raise exception 'Stok tidak mencukupi untuk item %', coalesce(it->>'product_name', it->>'name', '?');
      end if;
      update public.product_variants
         set stock = stock - v_qty,
             sold_count = coalesce(sold_count, 0) + v_qty,
             updated_at = now()
       where id = v_id;
    end if;
  end loop;

  if nullif(p_promo_code, '') is not null then
    insert into public.promo_claims (code, visitor_id)
    select p_promo_code, p_visitor_id
     where not exists (
       select 1 from public.promo_claims
        where code = p_promo_code and visitor_id = p_visitor_id);
    update public.promo_codes
       set used_count = coalesce(used_count, 0) + 1,
           updated_at = now()
     where code = p_promo_code;
  end if;

  insert into public.orders
    (order_code, status, items, subtotal_idr, discount_percent, total_idr,
     promo_code, customer_whatsapp, payment_proof_url, notes, buyer_email, visitor_id)
  values
    (p_order_code, 'pending', coalesce(p_items, '[]'::jsonb), p_subtotal_idr,
     p_discount_percent, p_total_idr, nullif(p_promo_code, ''),
     p_customer_whatsapp, p_payment_proof_url, p_notes, nullif(trim(p_buyer_email), ''), p_visitor_id);

  return query
    select o.order_code, o.status, o.id
      from public.orders o where o.order_code = p_order_code;
end $$;

-- 1b) Overload 10 argumen untuk backward-compatibility dengan pemanggil lama
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
  p_notes text
)
returns table (order_code text, status text, id uuid)
language sql security definer
as $$
  select * from public.create_order_with_stock_check(
    p_visitor_id, p_order_code, p_items, p_promo_code,
    p_subtotal_idr, p_discount_percent, p_total_idr,
    p_payment_proof_url, p_customer_whatsapp, p_notes, null
  );
$$;

-- 2) Lookup publik status pesanan untuk halaman /status
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
  notes text,
  buyer_email text
)
language plpgsql security definer stable
as $$
begin
  return query
    select o.order_code, o.status, o.items, o.subtotal_idr, o.discount_percent,
           o.total_idr, o.promo_code, o.created_at, o.admin_note, o.notes, o.buyer_email
      from public.orders o where o.order_code = p_order_code;
end $$;

-- 3) Batalkan order + kembalikan stok varian + lepas klaim promo (admin)
create or replace function public.cancel_order_with_stock_restore(p_order_id uuid)
returns table (order_code text, status text)
language plpgsql security definer
as $$
declare
  o public.orders%rowtype;
  it jsonb;
  v_id uuid;
  v_qty int;
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
    v_id := nullif(it->>'variant_id', '')::uuid;
    v_qty := coalesce((it->>'qty')::int, 1);
    if v_id is not null then
      update public.product_variants
         set stock = stock + v_qty,
             sold_count = greatest(coalesce(sold_count, 0) - v_qty, 0),
             updated_at = now()
       where id = v_id;
    end if;
  end loop;

  if nullif(o.promo_code, '') is not null and o.visitor_id is not null then
    delete from public.promo_claims
     where code = o.promo_code and visitor_id = o.visitor_id;
    update public.promo_codes
       set used_count = greatest(coalesce(used_count, 0) - 1, 0),
           updated_at = now()
     where code = o.promo_code;
  end if;

  update public.orders
     set status = 'cancelled',
         inventory_released_at = now()
   where id = p_order_id;

  return query select x.order_code, x.status
    from public.orders x where x.id = p_order_id;
end $$;

-- 4) Validasi promo (cek aktif, tanggal kadaluarsa, klaim, kuota).
--    Return: -3 (kuota habis), -2 (sudah diklaim), -1 (expired), 0 (invalid), >0 (diskon %).
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
  if p.code is null or not p.is_active then return 0; end if;
  if p.expired_at is not null and p.expired_at < now() then return -1; end if;
  select exists(
    select 1 from public.promo_claims
     where code = p.code and visitor_id = p_visitor_id) into claimed;
  if claimed then return -2; end if;
  if p.max_uses is not null and p.max_uses > 0 and coalesce(p.used_count, 0) >= p.max_uses then return -3; end if;
  return p.percent;
end $$;

-- 5) Catat kunjungan unik per visitor per hari
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
       and visited_at >= date_trunc('day', now())) into already;

  insert into public.page_views (visitor_id, path)
  values (p_visitor_id, current_setting('request.path', true));

  insert into public.daily_stats (date, unique_views)
  values (current_date, (case when already then 0 else 1 end))
  on conflict (date) do update
     set unique_views = coalesce(daily_stats.unique_views, 0) + (case when already then 0 else 1 end);

  update public.site_stats
     set total_views = coalesce(total_views, 0) + 1,
         today_views = (case when last_date = current_date then coalesce(today_views, 0) + 1 else 1 end),
         last_date = current_date
   where id = 1;
end $$;

-- 6) Fallback increment view tanpa argumen
create or replace function public.increment_view()
returns void
language plpgsql security definer
as $$
begin
  insert into public.daily_stats (date, unique_views)
  values (current_date, 1)
  on conflict (date) do update
     set unique_views = coalesce(daily_stats.unique_views, 0) + 1;

  update public.site_stats
     set total_views = coalesce(total_views, 0) + 1,
         today_views = (case when last_date = current_date then coalesce(today_views, 0) + 1 else 1 end),
         last_date = current_date
   where id = 1;
end $$;

-- 7) Rollup statistik publik (useLiveStats)
create or replace function public.get_public_stats()
returns jsonb
language sql security definer stable
as $$
  select jsonb_build_object(
    'total_views',       (select coalesce(total_views, 0) from public.site_stats where id = 1),
    'today_views',       (select coalesce(today_views, 0) from public.site_stats where id = 1),
    'last_7_days_views', (select coalesce(sum(unique_views), 0) from public.daily_stats where date >= current_date - 6),
    'total_orders',      (select count(*)::int from public.orders),
    'today_orders',      (select count(*)::int from public.orders where created_at >= date_trunc('day', now())),
    'week_orders',       (select count(*)::int from public.orders where created_at >= date_trunc('day', now()) - interval '6 days')
  );
$$;

-- 8) Total kunjungan unik
create or replace function public.get_public_visit_count()
returns integer
language sql security definer stable
as $$
  select coalesce(sum(unique_views), 0)::int from public.daily_stats;
$$;

-- 9) Deret statistik harian untuk chart analitik admin
create or replace function public.get_daily_stats(p_days integer default 30)
returns table (stat_date date, unique_views integer, total_orders integer, revenue_idr bigint)
language sql security definer stable
as $$
  select d.date as stat_date,
         coalesce(d.unique_views, 0) as unique_views,
         coalesce(d.total_orders, 0) as total_orders,
         coalesce(d.revenue_idr, 0) as revenue_idr
    from public.daily_stats d
   where d.date >= current_date - (p_days - 1)
   order by d.date;
$$;

-- 10) Statistik perbandingan pengunjung baru vs kembali
create or replace function public.get_visitor_stats(p_days integer default 7)
returns jsonb
language sql security definer stable
as $$
  select jsonb_build_object(
    'total_visitors',     (select count(*)::int from (select 1 from public.page_views where visited_at >= now() - make_interval(days => p_days) group by visitor_id) t),
    'returning_visitors', (select count(*)::int from (select 1 from public.page_views where visited_at >= now() - make_interval(days => p_days) group by visitor_id having count(*) > 1) r),
    'new_visitors',       (select count(*)::int from (select 1 from public.page_views where visited_at >= now() - make_interval(days => p_days) group by visitor_id having count(*) = 1) n)
  );
$$;

-- 11) Halaman terpopuler
create or replace function public.get_top_pages(p_days integer default 7, p_limit integer default 10)
returns table (path text, view_count bigint)
language sql security definer stable
as $$
  select pv.path, count(*)::bigint as view_count
    from public.page_views pv
   where pv.visited_at >= now() - make_interval(days => p_days)
   group by pv.path
   order by view_count desc
   limit p_limit;
$$;

-- 12) Produk terlaris (best sellers)
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

-- 13) Persentase retensi pengunjung (cohort return)
create or replace function public.get_cohort_return(p_days integer default 7)
returns integer
language sql security definer stable
as $$
  select coalesce(
    round(100.0 * sum(case when vc > 1 then 1 else 0 end) / nullif(count(*), 0)),
    0)::int
    from (select visitor_id, count(*) as vc
            from public.page_views
           where visited_at >= now() - make_interval(days => p_days)
           group by visitor_id) t;
$$;

-- 14) Validasi role admin
create or replace function public.is_admin()
returns boolean
language sql security definer stable
as $$
  select exists(
           select 1 from public.admin_users a where a.user_id = auth.uid()
         )
      or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

-- 15) Placeholder funnel summary jika funnel_events belum diterapkan
create or replace function public.get_funnel_summary(p_days integer default 7)
returns jsonb
language sql security definer stable
as $$
  select jsonb_build_object('days', p_days, 'steps', jsonb_build_array());
$$;

-- ── Hak Akses (Grants) ───────────────────────────────────────────────────────
grant execute on function public.get_order_public(text) to anon, authenticated;
grant execute on function public.create_order_with_stock_check(uuid, text, jsonb, text, integer, integer, integer, text, text, text, text) to anon, authenticated;
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
grant execute on function public.cancel_order_with_stock_restore(uuid) to authenticated;
