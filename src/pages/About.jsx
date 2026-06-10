import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown,
  CircleCheck,
  CircleHelp,
  ClipboardList,
  CreditCard,
  MessageCircle,
  PackageSearch,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react";
import { fetchSettings } from "../lib/api";
import { usePageMeta } from "../hooks/usePageMeta";
import EmptyState from "../components/EmptyState";

const FAQ_ITEMS = [
  {
    id: "qris-how",
    category: "payment",
    question: "Cara bayar di Imzaqi Store bagaimana?",
    answer: [
      "Pilih produk dan varian, lalu lanjut ke halaman bayar.",
      "Scan QRIS sesuai total yang tampil, lalu konfirmasi untuk membuat ID order.",
    ],
    tags: ["qris", "bayar", "payment", "scan"],
  },
  {
    id: "qris-locked",
    category: "payment",
    question: "Kenapa QRIS belum muncul?",
    answer: [
      "Biasanya karena nomor WhatsApp belum valid atau ada varian yang mewajibkan catatan email buyer.",
      "Lengkapi data di halaman bayar — QRIS akan terbuka otomatis.",
    ],
    tags: ["qris", "locked", "email", "catatan"],
  },
  {
    id: "promo",
    category: "payment",
    question: "Kalau pakai promo, total otomatis terpotong?",
    answer: [
      "Ya, jika promo valid potongan langsung dihitung di checkout dan status order.",
      "Jika promo tidak cocok, sistem menampilkan pesan dan total kembali normal.",
    ],
    tags: ["promo", "diskon", "checkout"],
  },
  {
    id: "after-pay",
    category: "order",
    question: "Setelah bayar, langkah selanjutnya apa?",
    answer: [
      "Simpan ID order yang muncul setelah konfirmasi pembayaran.",
      "Buka halaman Status dan masukkan ID untuk pantau progres terbaru.",
    ],
    tags: ["id order", "status", "setelah bayar"],
  },
  {
    id: "id-format",
    category: "order",
    question: "Format ID order seperti apa?",
    answer: [
      "Format utama: IMZ-ABCD.",
      "Di halaman status kamu bisa tempel kode pendek (ABCD) — sistem menormalisasi otomatis.",
    ],
    tags: ["format", "id", "imz"],
  },
  {
    id: "status-not-found",
    category: "order",
    question: "ID order tidak ditemukan, kenapa?",
    answer: [
      "Pastikan tidak ada salah ketik, terutama huruf dan angka.",
      "Jika tetap tidak ketemu, kirim ID ke admin untuk pengecekan manual.",
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
      "Ya, stok berkurang saat order berhasil diproses.",
      "Jika stok berubah saat checkout, sistem memberi notifikasi untuk review ulang.",
    ],
    tags: ["stok", "real-time", "checkout"],
  },
  {
    id: "buyer-email",
    category: "account",
    question: "Kenapa beberapa varian wajib isi email buyer?",
    answer: [
      "Sebagian layanan butuh email buyer untuk aktivasi atau onboarding akun.",
      "Varian yang diwajibkan menampilkan petunjuk otomatis di halaman bayar.",
    ],
    tags: ["email buyer", "aktivasi", "requires_buyer_email"],
  },
  {
    id: "notes-usage",
    category: "account",
    question: "Catatan pembeli dipakai untuk apa?",
    answer: [
      "Untuk info khusus seperti email aktivasi, preferensi proses, atau request tambahan.",
      "Catatan membantu admin memproses order lebih cepat dan akurat.",
    ],
    tags: ["catatan", "notes", "buyer"],
  },
  {
    id: "support-channel",
    category: "support",
    question: "Jika ada kendala, hubungi ke mana?",
    answer: [
      "Gunakan tombol Hubungi Admin dari halaman bayar atau status.",
      "Sertakan ID order agar pengecekan bisa langsung diproses.",
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

const HOWTO_STEPS = [
  {
    num: "01",
    icon: ShoppingBag,
    title: "Cari & pilih",
    desc: "Buka katalog, pilih produk dan varian yang sesuai budget.",
    to: "/produk",
  },
  {
    num: "02",
    icon: CreditCard,
    title: "Bayar QRIS",
    desc: "Scan via e-wallet atau m-banking. Nominal sudah otomatis.",
    to: "/bayar",
  },
  {
    num: "03",
    icon: ClipboardList,
    title: "Simpan ID",
    desc: "Setelah bayar, catat ID order (IMZ-XXXX) yang muncul.",
    to: "/status",
  },
  {
    num: "04",
    icon: CircleCheck,
    title: "Pantau progress",
    desc: "Masukkan ID di halaman Status — update real-time.",
    to: "/status",
  },
];

const CATEGORY_LABELS = Object.fromEntries(
  FAQ_CATEGORIES.filter((item) => item.key !== "all").map((item) => [item.key, item.label])
);

function faqMatches(item, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  const blob = [item.question, ...item.answer, ...(item.tags || [])].join(" ").toLowerCase();
  return blob.includes(q);
}

function FaqItem({ item, open, onToggle }) {
  const categoryLabel = CATEGORY_LABELS[item.category] || "FAQ";

  return (
    <article className={`faq-item${open ? " open" : ""}`}>
      <button
        type="button"
        className="faq-itemHead"
        aria-expanded={open}
        onClick={() => onToggle(item.id)}
      >
        <span className="faq-itemQuestion">
          <span className="faq-itemCategory">{categoryLabel}</span>
          <span>{item.question}</span>
        </span>
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
    description: "Jawaban cepat soal bayar, order, varian, dan aktivasi — biar nggak bingung.",
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

  const categoryCounts = useMemo(() => {
    const counts = { all: FAQ_ITEMS.length };
    FAQ_ITEMS.forEach((item) => {
      counts[item.category] = (counts[item.category] || 0) + 1;
    });
    return counts;
  }, []);

  const filteredFaq = useMemo(() => {
    return FAQ_ITEMS.filter((item) => {
      const matchCategory = activeCategory === "all" || item.category === activeCategory;
      const matchQuery = faqMatches(item, query);
      return matchCategory && matchQuery;
    });
  }, [activeCategory, query]);

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

  const emptySuggestions = useMemo(
    () => [
      { key: "clear", label: "Hapus pencarian", onClick: () => setQuery("") },
      { key: "all", label: "Semua kategori", onClick: () => setActiveCategory("all") },
      { key: "payment", label: "Pembayaran", onClick: () => setActiveCategory("payment") },
      { key: "order", label: "Order", onClick: () => setActiveCategory("order") },
    ],
    []
  );

  return (
    <div className="page">
      <section className="section faq-shell">
        <div className="container faq-wrap">
          <header className="faq-hero reveal">
            <div className="faq-heroCopy">
              <div className="faq-kicker">Pusat bantuan</div>
              <h1 className="h1 faq-title">Ada yang bingung?</h1>
              <p className="faq-sub">
                Bayar, order, produk, aktivasi — jawabannya ada di sini.
              </p>
            </div>
            <div className="faq-heroPill">
              <CircleHelp size={16} />
              <span>{filteredFaq.length} topik</span>
            </div>
          </header>

          <section className="faq-howto reveal" aria-label="Cara pesan">
            <div className="faq-howtoHead">
              <div className="faq-kicker">Cara pesan</div>
              <h2 className="faq-howtoTitle">4 langkah sampai order jalan</h2>
            </div>
            <div className="faq-howtoSteps">
              {HOWTO_STEPS.map((step) => {
                const Icon = step.icon;
                return (
                  <Link key={step.num} className="faq-howtoStep" to={step.to}>
                    <div className="faq-howtoNum">{step.num}</div>
                    <div className="faq-howtoIcon" aria-hidden="true">
                      <Icon size={22} />
                    </div>
                    <div className="faq-howtoCopy">
                      <strong>{step.title}</strong>
                      <p>{step.desc}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="faq-command reveal">
            <div className="faq-searchWrap">
              <Search size={16} />
              <input
                className="input faq-searchInput"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari: QRIS, ID order, email buyer, promo..."
                aria-label="Cari FAQ"
              />
              {query ? (
                <button
                  type="button"
                  className="faq-searchClear"
                  onClick={() => setQuery("")}
                  aria-label="Hapus pencarian"
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>

            <div className="faq-chips" role="tablist" aria-label="Filter kategori FAQ">
              {FAQ_CATEGORIES.map((category) => {
                const active = category.key === activeCategory;
                const count = categoryCounts[category.key] || 0;
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
                    <span className="faq-chipCount">{count}</span>
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
                  <EmptyState
                    icon={<PackageSearch size={28} />}
                    title="Tidak ada FAQ yang cocok"
                    description="Coba kata kunci lain atau pilih kategori berbeda."
                    suggestions={emptySuggestions}
                    primaryAction={{ label: "Lihat semua", onClick: () => { setQuery(""); setActiveCategory("all"); } }}
                  />
                </div>
              )}
            </main>

            <aside className="faq-side">
              <article className="faq-sideCard reveal">
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

              <article className="faq-sideCard faq-sideCardAccent reveal">
                <div className="faq-sideHead">
                  <ShieldCheck size={16} />
                  <h3>Butuh bantuan?</h3>
                </div>
                <ul className="faq-sideTips">
                  <li>Simpan ID order setelah pembayaran.</li>
                  <li>Isi catatan buyer jika varian minta email aktivasi.</li>
                  <li>Chat admin sambil sertakan ID order.</li>
                </ul>
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