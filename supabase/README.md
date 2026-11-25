# Supabase admin setup

## Cara daftar admin (pakai tabel `admin_users`)

Jalankan di **Supabase SQL Editor** (ganti email):

```sql
INSERT INTO public.admin_users (user_id, email)
SELECT id, email FROM auth.users WHERE email = 'admin@email.com'
ON CONFLICT (user_id) DO NOTHING;
```

Cek sudah masuk:

```sql
SELECT * FROM public.admin_users;
```

## Struktur migration (source of truth)

| File | Isi | Status |
|---|---|---|
| `migrations/0001_baseline.sql` | Skema tabel (17 tabel) + **15 RPC** sinkron dengan database produksi live (`create_order_with_stock_check`, `get_order_public`, `validate_promo`, analytics, `is_admin`, dll.) | Baseline historis |
| `migrations/0002_hardening.sql` | Unique `promo_claims(visitor_id, code)` + index pendukung & `buyer_email` | Aditif, idempotent |
| `migrations/0007_security_and_stock_hardening.sql` | Hardening RLS produksi (`is_admin()` SECURITY DEFINER, tutup semua policy `allow_*`), perbaikan bug +2× double-restore stok, validasi harga/promo/total server-side, kunci RPC analitik & legacy | ✅ DITERAPKAN di produksi |
| `migrations/0008_stage2_features_cleanup_and_business.sql` | `funnel_events` + `get_funnel_summary` (`jsonb`), `report_order_payment`, kolom testimoni & `referral_code`, hapus sampah `/__vitals/*` + retention helper, fondasi HPP (`variant_costs`), masa aktif/renewal H-3, & `admin_audit_logs` | ✅ DITERAPKAN di produksi (sumber bug `id` ambiguous sudah dipatch juga) |
| `migrations/0009_fix_create_order_ambiguous_id.sql` | Hotfix RPC `create_order_with_stock_check`: kualifikasi alias tabel (`pv`, `pc`, `pcl`) agar `WHERE pv.id = v_variant.id` tidak error `42702: column reference "id" is ambiguous` | Siap dijalankan di SQL Editor |
| `migrations/0010_testimonials_product_category.sql` | Tambah kolom opsional `product_id` & `category` beserta index pada `public.testimonials` | Siap dijalankan di SQL Editor |

> Catatan: migration lama bernomor `001`–`004` yang dulu tercantum di dokumen
> ini **tidak pernah ada** di repo, jadi referensinya dihapus.

### Verifikasi sebelum menerapkan ke produksi

```bash
supabase db dump --schema public -f prod_schema.sql
# bandingkan definisi fungsi di prod_schema.sql vs 0001_baseline.sql
```

Baseline memakai `CREATE TABLE IF NOT EXISTS` (no-op di produksi) tetapi
`CREATE OR REPLACE FUNCTION` (AKAN menimpa body fungsi live). Jadi jalankan
baseline hanya setelah diff, atau hanya pada environment baru / disaster
recovery.

Setelah insert ke `admin_users`, **logout lalu login ulang** di `/admin`.