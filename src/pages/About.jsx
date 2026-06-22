import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import "../css/pages/About.css";

const FAQ_ITEMS = [
  {
    id: "qris-how",
    category: "payment",
    question: "Gimana cara bayarnya?",
    answer: [
      "Pilih produk + varian, lanjut ke halaman bayar.",
      "Scan QRIS sesuai total, konfirmasi, dapet ID order.",
    ],
    tags: ["qris", "bayar", "payment", "scan"],
  },
  {
    id: "qris-locked",
    category: "payment",
    question: "QRIS-nya kok gak muncul?",
    answer: [
      "Biasanya karena nomor WA belum valid atau ada varian yang minta email buyer.",
      "Lengkapi data di halaman bayar — QRIS bakal kebuka otomatis.",
    ],
    tags: ["qris", "locked", "email", "catatan"],
  },
  {
    id: "promo",
    category: "payment",
    question: "Pakai promo, total auto kepotong?",
    answer: [
      "Iya, kalo promo valid potongan langsung keitung di checkout & status.",
      "Kalo promo gak cocok, sistem bakal ngasih tau dan total balik normal.",
    ],
    tags: ["promo", "diskon", "checkout"],
  },
  {
    id: "after-pay",
    category: "order",
    question: "Udah bayar, terus gimana?",
    answer: [
      "Simpen ID order yang muncul abis konfirmasi.",
      "Buka halaman Status, masukin ID buat pantau progres.",
    ],
    tags: ["id order", "status", "setelah bayar"],
  },
  {
    id: "id-format",
    category: "order",
    question: "Format ID order kayak gimana?",
    answer: [
      "Format utama: IMZ-ABCD.",
      "Di halaman status bisa tempel kode pendek (ABCD) — sistem otomatis normalisasi.",
    ],
    tags: ["format", "id", "imz"],
  },
  {
    id: "status-not-found",
    category: "order",
    question: "ID order gak ditemukan, kenapa?",
    answer: [
      "Pastikan gak ada salah ketik, apalagi huruf & angka yang mirip.",
      "Kalo tetep gak nemu, kirim ID ke admin buat dicek manual.",
    ],
    tags: ["not found", "status", "cek order"],
  },
  {
    id: "variant-diff",
    category: "product",
    question: "Bedanya produk sama varian apa?",
    answer: [
      "Produk itu layanan utama (Netflix, Canva, dll).",
      "Varian itu paket detailnya: durasi, jenis akun, harga, garansi, & stok.",
    ],
    tags: ["produk", "varian", "paket"],
  },
  {
    id: "stock-update",
    category: "product",
    question: "Stok di website real-time gak?",
    answer: [
      "Iya, stok berkurang pas order berhasil diproses.",
      "Kalo stok berubah pas checkout, sistem bakal notifikasi buat review ulang.",
    ],
    tags: ["stok", "real-time", "checkout"],
  },
  {
    id: "buyer-email",
    category: "account",
    question: "Kenapa beberapa varian wajib isi email?",
    answer: [
      "Beberapa layanan butuh email buyer buat aktivasi akun.",
      "Varian yang mewajibkan bakal nampilin petunjuk otomatis di halaman bayar.",
    ],
    tags: ["email buyer", "aktivasi", "requires_buyer_email"],
  },
  {
    id: "notes-usage",
    category: "account",
    question: "Catatan pembeli dipakai buat apa?",
    answer: [
      "Buat info khusus kayak email aktivasi, preferensi, atau request tambahan.",
      "Catatan bantu admin proses order lebih cepet & akurat.",
    ],
    tags: ["catatan", "notes", "buyer"],
  },
  {
    id: "support-channel",
    category: "support",
    question: "Error/error, hubungi ke mana?",
    answer: [
      "Pencet tombol Hubungi Admin di halaman bayar atau status.",
      "Sertain ID order biar ceknya cepet diproses.",
    ],
    tags: ["admin", "wa", "support", "kendala"],
  },
];

const FAQ_CATEGORIES = [
  { key: "all", label: "Semua" },
  { key: "payment", label: "Bayar" },
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
    desc: "Buka katalog, pilih produk & varian sesuai budget.",
    to: "/produk",
  },
  {
    num: "02",
    icon: CreditCard,
    title: "Bayar QRIS",
    desc: "Scan via e-wallet atau m-banking. Nominal udah otomatis.",
    to: "/bayar",
  },
  {
    num: "03",
    icon: ClipboardList,
    title: "Simpen ID",
    desc: "Abis bayar, catat ID order (IMZ-XXXX) yang muncul.",
    to: "/status",
  },
  {
    num: "04",
    icon: CircleCheck,
    title: "Pantau progress",
    desc: "Masukin ID di halaman Status — update real-time.",
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
    description: "Jawaban cepet soal bayar, order, varian, & aktivasi — biar gak bingung.",
  });

  const [waNumber, setWaNumber] = useState("6283136049987");
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const [activeCategory, setActiveCategory] = useState("all");
  const [openId, setOpenId] = useState("");

  // Sync state with URL search parameters
  useEffect(() => {
    const q = searchParams.get("q") || "";
    setQuery(q);
  }, [searchParams]);

  const handleQueryChange = (val) => {
    setQuery(val);
    setSearchParams(
      (prev) => {
        if (val) {
          prev.set("q", val);
        } else {
          prev.delete("q");
        }
        return prev;
      },
      { replace: true }
    );
  };

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
      { key: "clear", label: "Hapus pencarian", onClick: () => handleQueryChange("") },
      { key: "all", label: "Semua kategori", onClick: () => setActiveCategory("all") },
      { key: "payment", label: "Bayar", onClick: () => setActiveCategory("payment") },
      { key: "order", label: "Order", onClick: () => setActiveCategory("order") },
    ],
    [setSearchParams]
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
              <h2 className="faq-howtoTitle">4 langkah, gas!</h2>
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
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Cari: QRIS, ID order, email, promo..."
                aria-label="Cari FAQ"
              />
              {query ? (
                <button
                  type="button"
                  className="faq-searchClear"
                  onClick={() => handleQueryChange("")}
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
                    title="Gak ada FAQ yang cocok"
                    description="Coba kata kunci lain atau pilih kategori beda."
                    suggestions={emptySuggestions}
                    primaryAction={{ label: "Lihat semua", onClick: () => { handleQueryChange(""); setActiveCategory("all"); } }}
                  />
                </div>
              )}
            </main>

            <aside className="faq-side">
              <article className="faq-sideCard reveal">
                <div className="faq-sideHead">
                  <Sparkles size={16} />
                  <h3>Akses cepet</h3>
                </div>
                <div className="faq-sideActions">
                  <Link className="btn btn-wide" to="/produk">
                    Intip produk
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
                  <li>Simpen ID order abis bayar.</li>
                  <li>Isi catatan kalo varian minta email aktivasi.</li>
                  <li>Chat admin sertain ID order.</li>
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