# CSS split

File ini dibuat otomatis untuk memecah `src/index.css` jadi lebih modular.

- `src/index.css` sekarang hanya berisi `@import` ke file-file di folder ini.
- `src/css/global.css` : global/base + shared components
- `src/css/pages/*.css` : CSS khusus per halaman/menu (route)

Catatan:
- `src/index.legacy.css` disimpan sebagai backup CSS lama.
