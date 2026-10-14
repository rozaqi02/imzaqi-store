/**
 * Saklar fitur sementara untuk storefront.
 *
 * MASCOTS_ENABLED = false → SEMUA karakter maskot disembunyikan dari UI
 * (banner promo, popup, empty state, 404, modal pembayaran, dll).
 *
 * Penting:
 * • Aset gambar di `public/mascots/` SENGAJA TETAP DISIMPAN, tidak dihapus.
 * • Tidak ada satu pun call site yang perlu diedit — `BannerGraphic` menjadi
 *   satu-satunya titik render maskot, jadi saklar ini cukup di sini.
 * • Untuk mengaktifkan kembali, ubah nilai di bawah menjadi `true`.
 */
export const MASCOTS_ENABLED = false;
