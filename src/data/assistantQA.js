/**
 * 40 pre-defined Q&A pairs for the AI Assistant.
 * No manual user input — user picks from these prompts.
 *
 * Each item has:
 *  - id: unique key
 *  - q: prompt the user "asks"
 *  - a: assistant's reply (array of paragraph strings or { type, content })
 *  - tags: categories used for follow-up suggestions
 *  - starter: marked true if shown in the initial 3 starter chips
 */

export const ASSISTANT_QA = [
  // ── Garansi & Klaim ────────────────────────────────────────────────
  {
    id: "klaim-garansi",
    q: "Mau klaim garansi dong",
    starter: true,
    tags: ["garansi"],
    a: [
      "Tentu, saya bantu prosesnya 🤝",
      "Untuk klaim garansi, siapkan dulu **ID Order** kamu, lalu kirim ke admin lewat WhatsApp dengan format: `Klaim garansi - IMZ-XXXX - kendala: <jelaskan singkat>`.",
      "Hubungi admin di **WA: 0831-3604-9987** (https://wa.me/6283136049987).",
      "Garansi berlaku selama periode yang tertulis di varian (mis. 1 bulan / 6 bulan / 1 tahun) selama akun tidak diutak-atik di luar instruksi.",
    ],
  },
  {
    id: "garansi-berapa-lama",
    q: "Berapa lama garansi tiap produknya?",
    tags: ["garansi"],
    a: [
      "Setiap varian punya periode garansi sendiri yang tertera di kartu paket — biasanya 1 bulan, 3 bulan, 6 bulan, sampai lifetime.",
      "Lihat detail di halaman produk → buka paket yang kamu beli, dan periode garansi muncul sebagai chip di kartunya.",
    ],
  },
  {
    id: "garansi-mati-mendadak",
    q: "Akun tiba-tiba ke-logout, apa diganti?",
    tags: ["garansi"],
    a: [
      "Ya — selama dalam masa garansi dan akun tidak diubah passwordnya oleh kamu, admin akan replace.",
      "Kirim ID order ke admin di **WA: 0831-3604-9987** dan jelaskan kapan terakhir akun bekerja. Admin proses biasanya < 1 jam pas jam aktif.",
    ],
  },
  {
    id: "garansi-bukan-imzaqi",
    q: "Akun yang aku punya bukan dari Imzaqi, bisa garansi?",
    tags: ["garansi"],
    a: [
      "Maaf, garansi hanya berlaku untuk akun yang dibeli langsung di Imzaqi Store dengan ID order valid.",
      "Kalau mau aman, beli ulang di sini biar dapat support penuh. Hubungi admin di **WA: 0831-3604-9987** untuk info paket.",
    ],
  },

  // ── Pembayaran ──────────────────────────────────────────────────────
  {
    id: "cara-bayar",
    q: "Gimana cara bayar?",
    starter: true,
    tags: ["bayar"],
    a: [
      "Pembayaran 100% via **QRIS** — bisa scan dari semua e-wallet & m-banking (GoPay, OVO, DANA, ShopeePay, BCA Mobile, dll).",
      "Setelah checkout, kamu akan diarahkan ke halaman QRIS dengan nominal yang sudah disesuaikan otomatis.",
    ],
  },
  {
    id: "qris-tidak-jalan",
    q: "QRIS gagal scan, gimana?",
    tags: ["bayar"],
    a: [
      "Coba refresh halaman QRIS — terkadang token sesi expired.",
      "Pastikan jaringan stabil dan aplikasi e-wallet kamu support QRIS dinamis.",
      "Kalau masih gagal, screenshot error dan kirim ke admin via WhatsApp.",
    ],
  },
  {
    id: "transfer-manual",
    q: "Bisa transfer manual?",
    tags: ["bayar"],
    a: [
      "Default-nya QRIS karena lebih cepat verifikasinya.",
      "Untuk kasus khusus (mis. nominal kecil & e-wallet penuh), chat admin dulu — admin bisa kasih opsi alternatif.",
    ],
  },
  {
    id: "sudah-bayar-belum-konfirmasi",
    q: "Aku sudah bayar tapi statusnya masih pending",
    tags: ["bayar", "status"],
    a: [
      "Tenang, biasanya konfirmasi otomatis dalam 1–5 menit.",
      "Buka halaman **Status Order** dan masukkan ID order kamu.",
      "Kalau sudah > 15 menit dan masih pending, kirim bukti bayar + ID order ke admin.",
    ],
  },
  {
    id: "salah-nominal",
    q: "Aku bayar nominalnya kelebihan/kurang",
    tags: ["bayar"],
    a: [
      "Untuk **kurang bayar**: order tidak akan diproses, kamu bisa lunasi sisanya atau minta admin batalkan.",
      "Untuk **lebih bayar**: kirim bukti ke admin, kelebihan akan dikembalikan via e-wallet kamu.",
    ],
  },

  // ── Order & Status ──────────────────────────────────────────────────
  {
    id: "cek-status",
    q: "Cara cek status order?",
    starter: true,
    tags: ["status"],
    a: [
      "Buka tab **Status Order** di header → masukkan ID order kamu → tap Cek.",
      "Format ID: `IMZ-XXXX` (4 karakter setelah IMZ-). Otomatis di-format kalau cuma kasih 4 karakternya.",
    ],
  },
  {
    id: "lupa-id-order",
    q: "Aku lupa ID ordernya",
    tags: ["status"],
    a: [
      "Cek inbox WhatsApp dari admin — biasanya ID dikirim sesaat setelah pembayaran terkonfirmasi.",
      "Kalau tetap tidak ketemu, sebut nama produk + nominal bayar + tanggal ke admin agar dilacak manual.",
    ],
  },
  {
    id: "berapa-lama-proses",
    q: "Berapa lama prosesnya?",
    tags: ["status"],
    a: [
      "**Akun ready stock** → 5–30 menit pas jam aktif (08.00–22.00 WIB).",
      "**Akun custom (butuh email kamu)** → 30 menit – 2 jam.",
      "Di luar jam aktif, akan diproses besok pagi.",
    ],
  },
  {
    id: "order-tidak-ditemukan",
    q: "Status bilang 'order tidak ditemukan'",
    tags: ["status"],
    a: [
      "Pastikan ID kamu betul (4 karakter setelah `IMZ-`).",
      "Kalau baru bayar < 1 menit, tunggu sebentar lalu coba lagi.",
      "Masih tidak ketemu? Kirim screenshot ke admin agar dicek manual.",
    ],
  },
  {
    id: "ubah-pesanan",
    q: "Bisa ubah pesanan setelah checkout?",
    tags: ["status"],
    a: [
      "Selama pembayaran belum dilakukan, kamu bisa kembali ke checkout dan edit isi keranjang.",
      "Kalau sudah bayar, perubahan harus lewat admin — tergantung statusnya, bisa diganti atau direfund.",
    ],
  },
  {
    id: "batal-order",
    q: "Mau batalkan order, gimana?",
    tags: ["status"],
    a: [
      "Sebelum bayar — cukup tinggalkan halaman checkout, order tidak masuk sistem.",
      "Sudah bayar tapi belum diproses — chat admin segera, refund 100% via e-wallet.",
      "Sudah diproses (akun sudah dikirim) — refund tidak bisa, tapi bisa upgrade/swap dengan biaya selisih.",
    ],
  },

  // ── Produk & Varian ─────────────────────────────────────────────────
  {
    id: "perbedaan-private-sharing",
    q: "Bedanya private sama sharing apa?",
    tags: ["produk"],
    a: [
      "**Sharing**: kamu pakai 1 akun bersama beberapa orang (max 4–5 user). Lebih murah, tapi kemungkinan kelogout sedikit lebih tinggi.",
      "**Private**: akun full milik kamu sendiri sampai akhir periode. Lebih stabil, garansi lebih panjang.",
    ],
  },
  {
    id: "varian-mana-cocok",
    q: "Varian mana yang paling cocok untukku?",
    tags: ["produk"],
    a: [
      "Kalau cuma untuk diri sendiri & sering dipakai → pilih **Private** untuk stabilitas.",
      "Kalau berbagi dengan keluarga/teman → **Family / Sharing** lebih hemat.",
      "Kalau cuma butuh sebentar (1 bulan) → varian termurah sudah cukup.",
    ],
  },
  {
    id: "stok-habis",
    q: "Produk yang aku mau stoknya habis",
    tags: ["produk"],
    a: [
      "Stok biasanya restocked dalam 1–3 hari.",
      "Kamu bisa filter di katalog dengan toggle **Baru di stok** untuk lihat varian yang baru di-restock.",
      "Atau chat admin untuk minta notif kalau stok masuk lagi.",
    ],
  },
  {
    id: "produk-baru",
    q: "Ada produk baru?",
    tags: ["produk"],
    a: [
      "Cek katalog dan aktifkan filter **Produk baru** — semua produk yang ditambahkan dalam 30 hari terakhir akan muncul.",
      "Kami rutin tambah produk subscription populer setiap bulan.",
    ],
  },

  // ── Akun & Aktivasi ─────────────────────────────────────────────────
  {
    id: "akun-cara-pakai",
    q: "Cara pakai akun yang sudah dibeli?",
    tags: ["akun"],
    a: [
      "Setelah pembayaran terkonfirmasi, admin akan kirim detail akun (email + password atau invitation link) via WhatsApp.",
      "Login pakai detail tersebut. Jangan ubah password kecuali diizinkan admin.",
    ],
  },
  {
    id: "ubah-password",
    q: "Bisa ubah password akunnya?",
    tags: ["akun"],
    a: [
      "**Tidak boleh** untuk akun sharing — akan menyebabkan user lain ke-logout dan garansi gugur.",
      "Untuk akun private, biasanya admin sudah ganti ke yang aman. Jangan ubah lagi kecuali admin instruksikan.",
    ],
  },
  {
    id: "butuh-email-aktivasi",
    q: "Apa itu varian 'butuh email aktivasi'?",
    tags: ["akun"],
    a: [
      "Beberapa varian (mis. Canva Edu lifetime) perlu email kamu sendiri agar admin bisa aktivasi langsung di akunmu.",
      "Saat checkout, isi field email aktivasi di catatan buyer. Pastikan email valid dan kamu bisa akses.",
    ],
  },
  {
    id: "akun-tidak-bisa-login",
    q: "Akun tidak bisa login",
    tags: ["akun", "garansi"],
    a: [
      "Cek dulu: apakah typo email/password? Pastikan copy-paste presis.",
      "Kalau credential betul tapi tetap gagal, kemungkinan akun sedang re-stocked admin — chat admin dengan ID order, biasanya solved < 30 menit.",
    ],
  },

  // ── Promo & Diskon ──────────────────────────────────────────────────
  {
    id: "ada-promo",
    q: "Ada kode promo aktif?",
    tags: ["promo"],
    a: [
      "Kode promo aktif diumumkan via Instagram & status WhatsApp Imzaqi Store.",
      "Saat checkout, masukkan kode di field **Kode promo** dan tap Pakai.",
    ],
  },
  {
    id: "promo-tidak-bisa",
    q: "Kode promo tidak berhasil dipakai",
    tags: ["promo"],
    a: [
      "Cek lagi: huruf besar/kecil tidak masalah, tapi pastikan tidak ada spasi.",
      "Kode mungkin sudah kedaluwarsa atau hanya untuk produk tertentu.",
      "Chat admin kalau yakin kode-nya benar dan masih aktif.",
    ],
  },
  {
    id: "promo-buat-newbie",
    q: "Aku baru pertama beli, ada promo khusus?",
    tags: ["promo"],
    a: [
      "Cek pin di Instagram untuk welcome promo.",
      "Sering juga ada flash sale tiap akhir minggu — pantau katalog dengan filter **Promo**.",
    ],
  },

  // ── Pengiriman & Format ─────────────────────────────────────────────
  {
    id: "akun-kirim-via-apa",
    q: "Akun dikirim via apa?",
    tags: ["pengiriman"],
    a: [
      "Standard via **WhatsApp** ke nomor yang kamu daftarkan saat checkout.",
      "Untuk varian dengan email aktivasi, akan ada konfirmasi tambahan ke email kamu.",
    ],
  },
  {
    id: "salah-nomor-wa",
    q: "Aku salah masukin nomor WA",
    tags: ["pengiriman"],
    a: [
      "Chat admin secepatnya dengan ID order + nomor WA yang benar — sebelum diproses, masih bisa diupdate.",
      "Kalau sudah dikirim ke nomor lama, admin akan kirim ulang ke nomor baru (pastikan nomor lama tidak akses).",
    ],
  },

  // ── Refund ──────────────────────────────────────────────────────────
  {
    id: "cara-refund",
    q: "Cara refund?",
    tags: ["refund"],
    a: [
      "Refund hanya berlaku untuk: stok habis sebelum diproses, kelebihan bayar, atau order yang dibatalkan sebelum dikirim.",
      "Kirim ID order + nomor e-wallet/rek ke admin. Refund cair dalam 1–24 jam.",
    ],
  },
  {
    id: "refund-tidak-cair",
    q: "Refund belum cair",
    tags: ["refund"],
    a: [
      "Cek mutasi e-wallet/bank kamu — kadang masuk dengan keterangan unik dari payment gateway.",
      "Kalau > 24 jam dan tidak ada masuk, kirim bukti chat admin sebelumnya + nomor e-wallet ke admin.",
    ],
  },

  // ── Toko & Lainnya ──────────────────────────────────────────────────
  {
    id: "jam-operasional",
    q: "Jam operasional admin?",
    tags: ["toko"],
    a: [
      "Admin aktif **08.00 – 22.00 WIB** setiap hari termasuk weekend.",
      "Di luar jam tersebut, chat tetap masuk dan akan dibalas pertama kali besok pagi.",
    ],
  },
  {
    id: "asli-ga",
    q: "Akun yang dijual asli atau bajakan?",
    tags: ["toko"],
    a: [
      "**100% asli** — semua akun adalah hasil subscription resmi yang dibagikan/diprivat ulang.",
      "Buktinya: bisa cek di app langsung tanpa watermark/limit aneh, plus garansi penggantian.",
    ],
  },
  {
    id: "aman-ga",
    q: "Aman beli di sini?",
    tags: ["toko"],
    a: [
      "Aman. Kami pakai pembayaran terverifikasi (QRIS), ID order resmi, dan garansi tertulis di setiap varian.",
      "Cek halaman **Testimoni** untuk lihat review dari pembeli sebelumnya.",
    ],
  },
  {
    id: "kontak-admin",
    q: "Kontak admin langsung",
    tags: ["toko"],
    a: [
      "WhatsApp: 0831-3604-9987 (Admin Imzaqi).",
      "Saat chat, sertakan ID order kalau ada, biar respon lebih cepat.",
    ],
  },
  {
    id: "alamat-toko",
    q: "Alamat fisik tokonya di mana?",
    tags: ["toko"],
    a: [
      "Imzaqi Store adalah **toko 100% online** — semua transaksi via web ini & WhatsApp.",
      "Tidak ada outlet fisik, biaya operasi rendah = harga akun lebih murah untuk kamu.",
    ],
  },
  {
    id: "rekomendasi-paket-hemat",
    q: "Rekomendasi paket hemat?",
    tags: ["produk"],
    a: [
      "Filter di katalog dengan toggle **Di bawah 10rb** untuk lihat semua varian termurah.",
      "Top picks di kategori Streaming: Netflix Sharing 1 bulan, Spotify Family slot.",
      "Top picks Tools: ChatGPT Sharing, Canva Edu lifetime.",
    ],
  },
  {
    id: "rekomendasi-keluarga",
    q: "Untuk keluarga banyak orang, rekomendasinya?",
    tags: ["produk"],
    a: [
      "Pilih varian **Family / Premium** — biasanya support 4–6 user dengan profil terpisah.",
      "Top picks: Netflix Premium Family, YouTube Premium Family, Spotify Family.",
    ],
  },

  // ── Edukasi singkat ─────────────────────────────────────────────────
  {
    id: "kenapa-murah",
    q: "Kenapa harganya bisa lebih murah dari official?",
    tags: ["toko"],
    a: [
      "Kami subscribe paket **Family/Premium plan** yang slot-nya kemudian dibagi ke beberapa user.",
      "Tiap user dapat akses penuh, tapi cost-nya jauh lebih ringan karena di-share.",
    ],
  },
  {
    id: "bisa-buat-bisnis",
    q: "Bisa untuk akun bisnis/seller?",
    tags: ["produk"],
    a: [
      "Kami sediakan varian **Business / Seller** untuk produk tertentu (mis. ChatGPT Business, Canva Pro).",
      "Filter di katalog → kategori **Tools** → pilih varian dengan label Business/Pro.",
    ],
  },
  {
    id: "bayar-dulu-akun-belakangan",
    q: "Akunnya dikirim sebelum atau sesudah bayar?",
    tags: ["bayar"],
    a: [
      "**Sesudah pembayaran terkonfirmasi**, admin akan kirim detail akun via WhatsApp.",
      "Pengiriman tidak akan dilakukan sebelum konfirmasi pembayaran masuk — ini SOP keamanan kedua belah pihak.",
    ],
  },
  {
    id: "ucapan-terima-kasih",
    q: "Terima kasih, pelayanannya bagus!",
    tags: ["toko"],
    a: [
      "Sama-sama 🙏 Terima kasih sudah belanja di Imzaqi Store.",
      "Kalau berkenan, bantu drop review di tab **Testimoni** ya — sangat membantu user lain mempertimbangkan.",
    ],
  },
];

export const ASSISTANT_STARTERS = ASSISTANT_QA.filter((q) => q.starter).slice(0, 3);

/**
 * Get follow-up suggestions based on the last asked question's tags.
 * Returns 3 distinct items, excluding ones already shown in history.
 */
export function getFollowUps(lastItem, history = []) {
  if (!lastItem) return ASSISTANT_STARTERS;
  const askedIds = new Set(history.map((h) => h.id).concat(lastItem.id));
  const sameTags = ASSISTANT_QA.filter(
    (q) => !askedIds.has(q.id) && q.tags.some((t) => lastItem.tags.includes(t))
  );
  const fallback = ASSISTANT_QA.filter((q) => !askedIds.has(q.id));
  const pool = sameTags.length >= 3 ? sameTags : sameTags.concat(fallback);
  // Deduplicate while preserving order
  const seen = new Set();
  const result = [];
  for (const item of pool) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
    if (result.length === 3) break;
  }
  return result;
}
