import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown,
  CircleHelp,
  CreditCard,
  MessageCircle,
  ReceiptText,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { fetchSettings } from "../lib/api";
import { usePageMeta } from "../hooks/usePageMeta";

const FAQ_ITEMS = [
  {
    id: "qris-how",
    category: "payment",
    question: "Cara bayar di Imzaqi Store bagaimana?",
    answer: [
      "Pilih produk dan varian dulu, lalu lanjut ke halaman bayar.",
      "Scan QRIS sesuai total yang tampil, lalu tekan tombol konfirmasi untuk membuat ID order.",
    ],
    tags: ["qris", "bayar", "payment", "scan"],
  },
  {
    id: "qris-locked",
    category: "payment",
    question: "Kenapa QRIS belum muncul?",
    answer: [
      "Biasanya karena nomor WhatsApp belum valid atau ada varian yang mewajibkan catatan email buyer.",
      "Lengkapi data yang diminta di halaman bayar, maka QRIS akan otomatis terbuka.",
    ],
    tags: ["qris", "locked", "email", "catatan"],
  },
  {
    id: "after-pay",
    category: "order",
    question: "Setelah bayar, langkah selanjutnya apa?",
    answer: [
      "Simpan ID order yang muncul di pop-up.",
      "Masuk ke halaman Status dan masukkan ID tersebut untuk pantau progres terbaru.",
    ],
    tags: ["id order", "status", "setelah bayar"],
  },
  {
    id: "id-format",
    category: "order",
    question: "Format ID order seperti apa?",
    answer: [
      "Format utama: IMZ-ABCD.",
      "Di halaman status kamu juga bisa tempel kode pendek (ABCD), sistem akan normalisasi otomatis.",
    ],
    tags: ["format", "id", "imz"],
  },
  {
    id: "status-not-found",
    category: "order",
    question: "ID order tidak ditemukan, kenapa?",
    answer: [
      "Pastikan tidak ada salah ketik, terutama huruf dan angka.",
      "Kalau tetap tidak ketemu, kirim ID yang kamu punya ke admin agar dicek manual.",
    ],
    tags: ["not found", "status", "cek order"],
  },
  {
    id: "variant-diff",
    category: "product",
    question: "Bedanya produk dan varian apa?",
    answer: [
      "Produk adalah layanan utama (misalnya Netflix, Canva, dan lainnya).",
      "Varian adalah paket detailnya: durasi, jenis akun, harga, garansi, dan stok.",
    ],
    tags: ["produk", "varian", "paket"],
  },
  {
    id: "stock-update",
    category: "product",
    question: "Stok di website real-time tidak?",
    answer: [
      "Ya, stok akan berkurang saat order berhasil diproses.",
      "Kalau stok berubah saat checkout, sistem akan memberi notifikasi supaya kamu bisa review ulang.",
    ],
    tags: ["stok", "real-time", "checkout"],
  },
  {
    id: "duplicate-variant",
    category: "product",
    question: "Boleh ada nama varian atau label durasi yang mirip?",
    answer: [
      "Boleh, selama detail harga, garansi, dan stoknya jelas agar tidak membingungkan buyer.",
      "Disarankan tetap pakai penamaan konsisten supaya mudah dibaca di katalog.",
    ],
    tags: ["duplikat", "label durasi", "varian"],
  },
  {
    id: "buyer-email",
    category: "account",
    question: "Kenapa beberapa varian wajib isi email buyer?",
    answer: [
      "Sebagian layanan butuh email buyer untuk aktivasi atau onboarding akun.",
      "Varian yang diwajibkan akan menampilkan petunjuk otomatis di halaman bayar.",
    ],
    tags: ["email buyer", "aktivasi", "requires_buyer_email"],
  },
  {
    id: "notes-usage",
    category: "account",
    question: "Catatan pembeli dipakai untuk apa?",
    answer: [
      "Untuk info khusus seperti email aktivasi, preferensi proses, atau request tambahan.",
      "Catatan ini membantu admin memproses order lebih cepat dan akurat.",
    ],
    tags: ["catatan", "notes", "buyer"],
  },
  {
    id: "promo",
    category: "payment",
    question: "Kalau pakai promo, total otomatis terpotong?",
    answer: [
      "Ya, jika promo valid maka potongan langsung dihitung di ringkasan checkout dan status order.",
      "Jika promo tidak cocok, sistem akan tampilkan pesan dan total kembali normal.",
    ],
    tags: ["promo", "diskon", "checkout"],
  },
  {
    id: "support-channel",
    category: "support",
    question: "Jika ada kendala, hubungi ke mana?",
    answer: [
      "Gunakan tombol Hubungi Admin dari halaman bayar atau status.",
      "Sertakan ID order agar pengecekan bisa langsung diproses tanpa bolak-balik.",
    ],
    tags: ["admin", "wa", "support", "kendala"],
  },
];

const FAQ_CATEGORIES = [
  { key: "all", label: "Semua" },
  { key: "payment", label: "Pembayaran" },
  { key: "order", label: "Order & Status" },
  { key: "product", label: "Produk & Varian" },
  { key: "account", label: "Akun & Aktivasi" },
  { key: "support", label: "Bantuan" },
];

function faqMatches(item, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  const blob = [item.question, ...item.answer, ...(item.tags || [])].join(" ").toLowerCase();
  return blob.includes(q);
}

function FaqItem({ item, open, onToggle }) {
  return (
    <article className={`faq-item${open ? " open" : ""}`}>
      <button
        type="button"
        className="faq-itemHead"
        aria-expanded={open}
        onClick={() => onToggle(item.id)}
      >
        <span>{item.question}</span>
        <ChevronDown size={17} />
      </button>

      <div className="faq-itemBodyWrap" aria-hidden={!open}>
        <div className="faq-itemBody">
          {item.answer.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>
    </article>
  );
}

export default function About() {
  usePageMeta({
    title: "FAQ",
    description: "Pusat FAQ Imzaqi Store: pembayaran, order, varian, aktivasi, dan bantuan.",
  });

  const [waNumber, setWaNumber] = useState("6283136049987");
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [openId, setOpenId] = useState("");

  useEffect(() => {
    let active = true;
    fetchSettings()
      .then((result) => {
        if (!active) return;
        const next = String(result?.whatsapp?.number || "").trim();
        if (next) setWaNumber(next);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const filteredFaq = useMemo(() => {
    return FAQ_ITEMS.filter((item) => {
      const matchCategory = activeCategory === "all" || item.category === activeCategory;
      const matchQuery = faqMatches(item, query);
      return matchCategory && matchQuery;
    });
  }, [activeCategory, query]);

  // Close any open item that no longer matches the current filter; never
  // auto-open a default item — let the user choose what to expand.
  useEffect(() => {
    if (!openId) return;
    const exists = filteredFaq.some((item) => item.id === openId);
    if (!exists) setOpenId("");
  }, [filteredFaq, openId]);

  const handleToggle = (id) => {
    setOpenId((prev) => (prev === id ? "" : id));
  };

  const waUrl = useMemo(() => {
    const message = encodeURIComponent("Halo Admin Imzaqi Store, saya mau tanya terkait order/produk.");
    return `https://wa.me/${waNumber}?text=${message}`;
  }, [waNumber]);

  return (
    <div className="page">
      <section className="section faq-shell">
        <div className="container faq-wrap">
          <header className="faq-hero">
            <div className="faq-heroCopy">
              <div className="faq-kicker">FAQ Center</div>
              <h1 className="h1 faq-title">Ada yang bingung?</h1>
              <p className="faq-sub">
                Jawaban cepat soal bayar, order, produk, dan aktivasi. Langsung ketemu.
              </p>
            </div>
            <div className="faq-heroPill">
              <CircleHelp size={16} />
              <span>{FAQ_ITEMS.length} FAQ siap</span>
            </div>
          </header>

          {/* ── Cara Pesan Section ── */}
          <section className="faq-howto">
            <div className="faq-howtoHead">
              <div className="faq-kicker">Cara Pesan</div>
              <h2 className="faq-howtoTitle">Gampang banget, cuma 4 step</h2>
            </div>
            <div className="faq-howtoSteps">
              {[
                { num: "01", icon: "🛍️", title: "Pilih Produk", desc: "Buka katalog, pilih produk dan varian yang sesuai kebutuhan dan budget." },
                { num: "02", icon: "💳", title: "Bayar via QRIS", desc: "Scan QRIS dengan m-banking atau e-wallet. Nominal otomatis menyesuaikan total." },
                { num: "03", icon: "📋", title: "Simpan ID Order", desc: "Setelah konfirmasi, ID order (format IMZ-XXXX) akan muncul. Simpan baik-baik." },
                { num: "04", icon: "✅", title: "Pantau Status", desc: "Masukkan ID order di halaman Status untuk melihat progres terbaru." },
              ].map((step) => (
                <div key={step.num} className="faq-howtoStep">
                  <div className="faq-howtoNum">{step.num}</div>
                  <div className="faq-howtoEmoji">{step.icon}</div>
                  <div className="faq-howtoCopy">
                    <strong>{step.title}</strong>
                    <p>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="faq-command">
            <div className="faq-searchWrap">
              <Search size={16} />
              <input
                className="input faq-searchInput"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari: QRIS, ID order, email buyer, promo..."
              />
            </div>

            <div className="faq-chips" role="tablist" aria-label="Filter kategori FAQ">
              {FAQ_CATEGORIES.map((category) => {
                const active = category.key === activeCategory;
                return (
                  <button
                    key={category.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`faq-chip${active ? " active" : ""}`}
                    onClick={() => setActiveCategory(category.key)}
                  >
                    {category.label}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="faq-layout">
            <main className="faq-main">
              <div className="faq-listHead">
                <div className="faq-listKicker">Hasil</div>
                <div className="faq-listCount">{filteredFaq.length} pertanyaan</div>
              </div>

              {filteredFaq.length ? (
                <div className="faq-list">
                  {filteredFaq.map((item) => (
                    <FaqItem
                      key={item.id}
                      item={item}
                      open={item.id === openId}
                      onToggle={handleToggle}
                    />
                  ))}
                </div>
              ) : (
                <div className="faq-empty">
                  <div className="faq-emptyBadge">0</div>
                  <h2>Tidak ada FAQ yang cocok.</h2>
                  <p>Coba kata kunci lain atau pilih kategori "Semua".</p>
                </div>
              )}
            </main>

            <aside className="faq-side">
              <article className="faq-sideCard">
                <div className="faq-sideHead">
                  <Sparkles size={16} />
                  <h3>Akses cepat</h3>
                </div>
                <div className="faq-sideActions">
                  <Link className="btn btn-wide" to="/produk">
                    Lihat produk
                  </Link>
                  <Link className="btn btn-ghost btn-wide" to="/status">
                    Cek status
                  </Link>
                  <a className="btn btn-ghost btn-wide" href={waUrl} target="_blank" rel="noreferrer">
                    Hubungi admin
                  </a>
                </div>
              </article>

              <article className="faq-sideCard">
                <div className="faq-sideHead">
                  <ReceiptText size={16} />
                  <h3>Alur singkat</h3>
                </div>
                <div className="faq-steps">
                  <div className="faq-step">
                    <span>01</span>
                    <p>Pilih produk dan varian yang cocok.</p>
                  </div>
                  <div className="faq-step">
                    <span>02</span>
                    <p>Bayar via QRIS, lalu simpan ID order.</p>
                  </div>
                  <div className="faq-step">
                    <span>03</span>
                    <p>Pantau progres order di halaman status.</p>
                  </div>
                </div>
              </article>

              <article className="faq-sideCard">
                <div className="faq-sideHead">
                  <ShieldCheck size={16} />
                  <h3>Tips aman</h3>
                </div>
                <div className="faq-tips">
                  <p>Simpan ID order setelah pembayaran.</p>
                  <p>Isi catatan buyer jika varian meminta email aktivasi.</p>
                  <p>Hubungi admin dengan menyertakan ID order.</p>
                </div>
              </article>

              <article className="faq-sideCard faq-sideCardAccent">
                <div className="faq-sideHead">
                  <CreditCard size={16} />
                  <h3>Masih bingung?</h3>
                </div>
                <p className="faq-sideText">Tim admin siap bantu cek dari pembayaran sampai status aktivasi.</p>
                <a className="btn btn-wide" href={waUrl} target="_blank" rel="noreferrer">
                  Chat admin
                  <MessageCircle size={16} />
                </a>
              </article>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}
