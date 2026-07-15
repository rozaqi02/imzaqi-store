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

## Migration opsional

1. `migrations/002_admin_users_table.sql` — `is_admin()` + RLS baca baris sendiri
2. `migrations/001_admin_rls.sql` — kebijakan RLS tabel operasional (order, produk, dll.)
3. `migrations/003_products_category.sql` — kolom `products.category` + izinkan nilai `ai` / `design`

   **Wajib** jika admin dapat `400 Bad Request` saat ganti kategori ke AI/Design  
   (biasanya ENUM/CHECK lama hanya mengizinkan streaming/music/tools/learning/other).

   Setelah dijalankan di SQL Editor, reload schema cache PostgREST bila perlu  
   (Dashboard → Settings → API → Reload schema).

Setelah insert ke `admin_users`, **logout lalu login ulang** di `/admin`.