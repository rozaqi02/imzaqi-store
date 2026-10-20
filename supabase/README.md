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
| `migrations/0001_baseline.sql` | Skema tabel (17 tabel) + **15 RPC** sinkron dengan database produksi live (`create_order_with_stock_check`, `get_order_public`, `validate_promo`, analytics, `is_admin`, dll.) | ✅ SYNCHRONIZED dengan schema live |
| `migrations/0002_hardening.sql` | Unique `promo_claims(visitor_id, code)` + index pendukung & `buyer_email` | Aditif, idempotent, aman di produksi |
| `migrations/_archived/20260909_secure_checkout_funnel.sql` | Redesign "secure checkout" yang **ditinggalkan** | ❌ JANGAN diterapkan (me-REVOKE `get_order_public`) |
| `migrations/_archived/20260910_order_lookup_by_id.sql` | Varian `get_order_public_by_code` yang tak dipakai frontend | ❌ JANGAN diterapkan |

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