# Sistem CSS

Semua visual aplikasi dimuat dari satu entry point: `src/styles.css`.

- Komponen dan menu tidak boleh menambahkan `import "*.css"` sendiri.
- `src/styles.css` menentukan urutan cascade global, komponen, route, dan admin.
- File di `src/css/pages/` tetap menjadi sumber aturan layout per route, tetapi
  harus memakai token dari `theme-variables.css` dan selector yang di-scope ke
  kelas halaman agar tidak menimpa menu lain.
