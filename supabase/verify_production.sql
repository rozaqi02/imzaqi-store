-- =============================================================================
-- verify_production.sql — JALANKAN DI SUPABASE DASHBOARD (SQL EDITOR), READ-ONLY
-- Tujuan: membandingkan skema/RPC PRODUKSI yang sebenarnya dengan
--         supabase/migrations/0001_baseline.sql (yang masih hasil rekonstruksi).
-- Aman: hanya SELECT / introspeksi. TIDAK mengubah apa pun.
-- Cara: buka Project → SQL Editor → New query → tempel bagian ini → Run.
-- =============================================================================

-- 1) DAFTAR TABEL di schema public
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

-- 2) DAFTAR FUNCTION/RPC + signature + definisi lengkap (untuk diff vs baseline)
select p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname;

-- 3) STATUS RLS per tabel (harus true untuk semua tabel yang punya policy anon)
select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;

-- 4) POLICY per tabel (nama + command + role)
select schemaname, tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 5) KOLOM tabel-tabel kunci (cek kecocokan nama/tipe dengan baseline)
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('orders','order_items','products','product_variants',
                     'promo_codes','promo_claims','settings','testimonials',
                     'flash_sales','daily_stats','visitor_daily_stats','page_visit_daily_stats',
                     'admin_users','waitlist')
order by table_name, ordinal_position;

-- 6) INDEX pada tabel yang di-hardening (untuk cek apakah 0002 sudah ada/tidak)
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('promo_claims','orders','order_items','products','product_variants',
                    'daily_stats','visitor_daily_stats','page_visit_daily_stats','settings')
order by tablename, indexname;

-- 7) CONSTRAINT pada promo_claims (khusus: cek unique (visitor_id, code) dari 0002)
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.promo_claims'::regclass
order by conname;

-- 8) GRANT EXECUTE ke anon/authenticated pada RPC (cek apakah sudah ada)
select grantee, routine_name
from information_schema.routine_privileges
where routine_schema = 'public'
  and grantee in ('anon','authenticated')
order by routine_name, grantee;

-- 9) Cek pola admin_users: apakah user_id UUID (pola Supabase Auth) atau email-based (lama)?
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'admin_users'
order by ordinal_position;
