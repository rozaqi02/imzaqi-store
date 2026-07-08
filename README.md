# imzaqi.store — repositori privat

Kode sumber **toko resmi [imzaqi.store](https://imzaqi.store)** milik Imzaqi Store.

> **Bukan template, bukan white-label, bukan proyek open-source untuk dipasang ulang.**
> Repo ini hanya untuk pengembangan dan deploy toko Imzaqi sendiri. Jangan fork, salin, atau deploy ke domain/infrastruktur lain tanpa izin.

## Tentang toko

Toko digital subscription (Netflix, Spotify, Canva, ChatGPT, dll.) dengan checkout QRIS, lacak status order, dan panel admin internal.

| Lapisan | Teknologi |
|---------|-----------|
| Frontend | React 19 + Vite 8 |
| Backend | Supabase (Postgres, Auth, Storage, Realtime) |
| Hosting | Netlify |

**Versi rilis saat ini:** v5.2.1

## Catatan pengembangan (internal)

Perintah yang dipakai di lingkungan dev Imzaqi:

```bash
npm install
npm start          # dev server — http://localhost:5173
npm run build      # build production → dist/
npm test           # Vitest
```

Variabel lingkungan (`VITE_SUPABASE_*`) dikelola di `.env` lokal dan di dashboard Netlify — **jangan** dibagikan atau di-commit.

## Struktur singkat

```
src/pages/       Home, Products, ProductDetail, Checkout, Pay, Status, Admin
src/components/  UI reusable
src/lib/         API, Supabase client, format
public/          manifest, service worker, aset statis
supabase/        migrasi SQL (backend toko ini saja)
netlify/         serverless functions
```

## Hak cipta

© Imzaqi Store. Seluruh kode, branding, konten, dan konfigurasi backend terkait **imzaqi.store** adalah milik pribadi. Tidak ada lisensi untuk penggunaan, redistribusi, atau deploy oleh pihak ketiga.