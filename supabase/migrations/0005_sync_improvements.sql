-- ============================================================================
-- 0005_sync_improvements.sql
-- Migration aditif & idempoten agar skema PostgreSQL produksi sinkron penuh
-- dengan frontend, analytics funnel, restock requests, testimoni, bukti bayar,
-- dan program loyalitas lintas perangkat.
--
-- Aman dijalankan di Supabase SQL Editor tanpa mengubah/menghapus tabel ada.
-- ============================================================================

create extension if not exists pgcrypto;

-- 1) Funnel Analytics (disinkronkan termasuk 'order_reviewed' dari Status.jsx)
create table if not exists public.funnel_events (
  id bigint generated always as identity primary key,
  visitor_id uuid,
  session_id uuid not null,
  event_name text not null,
  path text,
  product_id uuid,
  variant_id uuid,
  order_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.funnel_events drop constraint if exists funnel_events_event_name_check;
alter table public.funnel_events add constraint funnel_events_event_name_check check (
  event_name in (
    'view_product',
    'add_to_cart',
    'buy_now',
    'begin_checkout',
    'apply_promo',
    'restock_request',
    'qris_opened',
    'manual_selected',
    'payment_failed',
    'payment_reported',
    'order_completed',
    'order_reviewed'
  )
);

create index if not exists idx_funnel_events_created_at on public.funnel_events(created_at desc);
create index if not exists idx_funnel_events_name_created on public.funnel_events(event_name, created_at desc);

alter table public.funnel_events enable row level security;

drop policy if exists "anon insert funnel_events" on public.funnel_events;
create policy "anon insert funnel_events"
  on public.funnel_events
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "admin read funnel_events" on public.funnel_events;
create policy "admin read funnel_events"
  on public.funnel_events
  for select
  to authenticated
  using (public.is_admin());

grant insert on public.funnel_events to anon, authenticated;
grant select on public.funnel_events to authenticated;

create or replace function public.get_funnel_summary(p_days integer default 7)
returns table (
  event_name text,
  total_events bigint,
  unique_sessions bigint
)
language sql
security definer
set search_path = public
as $$
  select
    fe.event_name,
    count(*)::bigint as total_events,
    count(distinct fe.session_id)::bigint as unique_sessions
  from public.funnel_events fe
  where public.is_admin()
    and fe.created_at >= now() - (greatest(1, least(coalesce(p_days, 7), 365)) || ' days')::interval
  group by fe.event_name;
$$;

grant execute on function public.get_funnel_summary(integer) to authenticated;

-- 2) Permintaan Restock (ProductDetail.jsx -> AdminDashboard.jsx)
create table if not exists public.restock_requests (
  id uuid not null default gen_random_uuid() primary key,
  visitor_id uuid not null,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  customer_whatsapp text not null,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_restock_requests_created on public.restock_requests(created_at desc);
create index if not exists idx_restock_requests_variant on public.restock_requests(variant_id, notified_at);
create unique index if not exists uniq_restock_request_wa_variant
  on public.restock_requests(variant_id, customer_whatsapp);

alter table public.restock_requests enable row level security;

drop policy if exists "anon create restock request" on public.restock_requests;
create policy "anon create restock request"
  on public.restock_requests
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "admin read restock requests" on public.restock_requests;
create policy "admin read restock requests"
  on public.restock_requests
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "admin update restock requests" on public.restock_requests;
create policy "admin update restock requests"
  on public.restock_requests
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant insert on public.restock_requests to anon, authenticated;
grant select, update on public.restock_requests to authenticated;

-- 3) Kolom terstruktur untuk Testimoni (sinkron dengan Testimonials.jsx & Admin)
alter table public.testimonials
  add column if not exists customer_name text,
  add column if not exists product_name text,
  add column if not exists purchased_at timestamptz,
  add column if not exists is_verified boolean not null default false,
  add column if not exists rating smallint;

alter table public.testimonials drop constraint if exists testimonials_rating_check;
alter table public.testimonials add constraint testimonials_rating_check
  check (rating is null or (rating >= 1 and rating <= 5));

-- 4) Kolom referral_code terstruktur pada Orders
alter table public.orders
  add column if not exists referral_code text;

create index if not exists idx_orders_referral_code
  on public.orders(referral_code)
  where referral_code is not null;

-- 5) RPC Lapor Pembayaran + Lampirkan Bukti Bayar oleh Pembeli via Order Code
create or replace function public.report_order_payment(
  p_order_code text,
  p_payment_proof_url text default null,
  p_payment_reference text default null
)
returns table (
  order_code text,
  status text,
  payment_proof_url text,
  payment_reported_at timestamptz,
  verification_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(p_order_code, '')));
  v_proof text := nullif(trim(coalesce(p_payment_proof_url, '')), '');
  v_ref text := nullif(trim(coalesce(p_payment_reference, '')), '');
begin
  if v_code = '' then
    raise exception 'ID pesanan wajib diisi.';
  end if;

  update public.orders o
     set payment_proof_url = coalesce(v_proof, o.payment_proof_url),
         payment_reference = coalesce(v_ref, o.payment_reference),
         payment_reported_at = coalesce(o.payment_reported_at, now()),
         verification_status = case when v_proof is not null then 'reported' else o.verification_status end,
         status = case when o.status = 'pending' then 'paid_reported' else o.status end
   where upper(o.order_code) = v_code
     and o.status in ('pending', 'paid_reported');

  return query
    select o.order_code, o.status, o.payment_proof_url, o.payment_reported_at, o.verification_status
      from public.orders o
     where upper(o.order_code) = v_code
     limit 1;
end;
$$;

grant execute on function public.report_order_payment(text, text, text) to anon, authenticated;

-- 6) RPC Kelayakan Loyalitas berdasarkan Nomor WhatsApp (lintas perangkat)
create or replace function public.get_loyalty_eligibility(p_whatsapp text)
returns table (
  completed_count integer,
  threshold integer,
  eligible boolean,
  promo_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_digits text := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  v_norm text;
  v_cnt integer := 0;
begin
  if v_digits like '08%' then
    v_norm := '628' || substr(v_digits, 3);
  elsif v_digits like '8%' then
    v_norm := '628' || substr(v_digits, 2);
  else
    v_norm := v_digits;
  end if;

  if length(v_norm) >= 10 then
    select count(*)::integer into v_cnt
      from public.orders o
     where o.status = 'done'
       and regexp_replace(coalesce(o.customer_whatsapp, ''), '\D', '', 'g') in (v_norm, v_digits, '0' || substr(v_norm, 3));
  end if;

  return query
    select v_cnt, 3, (v_cnt >= 3), 'PELANGGAN3'::text;
end;
$$;

grant execute on function public.get_loyalty_eligibility(text) to anon, authenticated;

-- 7) Storage bucket bukti transfer QRIS (payment-proofs)
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', true)
on conflict (id) do nothing;

drop policy if exists "public read payment proofs" on storage.objects;
create policy "public read payment proofs"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'payment-proofs');

drop policy if exists "anon upload payment proofs" on storage.objects;
create policy "anon upload payment proofs"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'payment-proofs');
