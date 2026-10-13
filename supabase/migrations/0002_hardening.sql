-- ============================================================================
-- 0002_hardening.sql — Audit keamanan: constraint & index yang hilang
-- ----------------------------------------------------------------------------
-- Aditif & idempotent. Aman dijalankan berulang dan aman di produksi
-- (semua operasi dijaga agar no-op bila objek sudah ada).
--
-- POSTUR RLS: operasi sensitif (checkout, lookup order, promo, analytics)
-- sudah dibungkus SECURITY DEFINER di 0001_baseline.sql sehingga tidak
-- bergantung pada policy tabel. Policy RLS tabel dikelola terpisah di
-- Supabase dashboard / migration awal — jangan diubah dari file ini.
-- ============================================================================

-- Tutup race double-claim promo (lihat src/hooks/usePromo.js:80-82).
-- Tanpa constraint ini, dua request paralel dari visitor yang sama bisa
-- mengklaim kode promo yang sama dua kali.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'promo_claims_visitor_code_unique'
  ) then
    alter table public.promo_claims
      add constraint promo_claims_visitor_code_unique
      unique (visitor_id, promo_code);
  end if;
end $$;

-- Index pendukung query yang dipakai frontend/admin.
-- (IF NOT EXISTS berdasarkan nama -> no-op bila sudah ada.)
create index if not exists idx_orders_status_created_at
  on public.orders (status, created_at desc);

create index if not exists idx_orders_created_at
  on public.orders (created_at desc);

create index if not exists idx_page_views_viewed_at
  on public.page_views (viewed_at desc);

create index if not exists idx_page_views_visitor_viewed
  on public.page_views (visitor_id, viewed_at desc);

create index if not exists idx_promo_claims_code
  on public.promo_claims (promo_code);
