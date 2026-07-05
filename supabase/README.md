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

Setelah insert ke `admin_users`, **logout lalu login ulang** di `/admin`.