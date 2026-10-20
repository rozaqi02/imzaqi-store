-- ============================================================================
-- 0002_hardening.sql — Audit keamanan: constraint & index yang hilang
-- ----------------------------------------------------------------------------
-- Aditif & idempotent. Aman dijalankan berulang dan aman di produksi
-- (semua operasi dijaga agar no-op bila objek sudah ada).
-- ============================================================================

-- Tutup race double-claim promo (lihat src/hooks/usePromo.js:80-82).
-- Menggunakan kolom 'code' sesuai skema asli promo_claims.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'promo_claims_visitor_code_unique'
  ) then
    alter table public.promo_claims
      add constraint promo_claims_visitor_code_unique
      unique (visitor_id, code);
  end if;
end $$;

-- Index pendukung query yang dipakai frontend/admin.
create index if not exists idx_orders_status_created_at
  on public.orders (status, created_at desc);

create index if not exists idx_orders_created_at
  on public.orders (created_at desc);

create index if not exists idx_orders_buyer_email
  on public.orders (buyer_email)
  where buyer_email is not null;

create index if not exists idx_page_views_visited_at
  on public.page_views (visited_at desc);

create index if not exists idx_page_views_visitor_visited
  on public.page_views (visitor_id, visited_at desc);

create index if not exists idx_promo_claims_code
  on public.promo_claims (code);
