# Imzaqi Store

Toko digital subscription (Netflix, Spotify, Canva, ChatGPT, dll.) dengan checkout QRIS, status order, dan admin dashboard.

- **Frontend:** React 19 + Vite 8
- **Backend:** Supabase (Postgres, Auth, Storage, Realtime)
- **Deploy:** Netlify

## Menjalankan lokal

```bash
npm install
cp .env.example .env   # isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY
npm start              # http://localhost:5173
```

## Scripts

| Perintah | Keterangan |
|----------|------------|
| `npm start` | Dev server (Vite) |
| `npm run build` | Build production ke `dist/` |
| `npm run preview` | Preview build lokal |
| `npm test` | Jalankan test Vitest |

## Environment

Buat file `.env` di root:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

## Supabase migrations

Dokumen & SQL terkait:

- [docs/backend-order-hardening.md](docs/backend-order-hardening.md)
- [supabase/migrations/20260408122000_harden_create_order_with_stock_check.sql](supabase/migrations/20260408122000_harden_create_order_with_stock_check.sql)
- [supabase/migrations/20260420164500_add_increment_unique_visit.sql](supabase/migrations/20260420164500_add_increment_unique_visit.sql)

Cara apply:

1. Buka Supabase Dashboard → SQL Editor
2. Copy isi file migration
3. Jalankan query, lalu uji flow checkout/pay

## Fitur utama

- Katalog produk & detail varian
- Keranjang + checkout drawer + pembayaran QRIS
- Lacak status order (`/status`)
- Admin dashboard (kelola produk, order, promo, testimoni)
- Export CSV order, notifikasi realtime order baru, salin link status
- PWA (manifest + service worker di production)

## Struktur folder

```
src/
  pages/        # Home, Products, ProductDetail, Checkout, Pay, Status, Admin
  components/   # UI reusable
  hooks/        # usePageMeta, usePromo, analytics, dll.
  lib/          # api.js, supabaseClient, format
public/         # manifest, sw.js, assets statis
supabase/       # SQL migrations
netlify/        # serverless functions
```