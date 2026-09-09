import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import "../css/support-surfaces.css";
import "../css/pages/Faq.css";
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
  ArrowUpRight,
  X,
} from "lucide-react";
import { fetchSettings } from "../lib/api";
import { usePageMeta } from "../hooks/usePageMeta";
import EmptyState from "./EmptyState";

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
      "Biasanya karena kontak belum valid atau email aktivasi belum lengkap.",
      "Lengkapi nomor WhatsApp & email buyer (kalo paket butuh email) di halaman bayar, nanti QRIS kebuka otomatis.",
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
      "Klik tombol 'Saya Sudah Bayar' setelah scan QRIS, lalu simpan ID order yang muncul.",
      "Kalo mau lebih cepet diproses, kirim bukti transfer ke WhatsApp admin.",
    ],
    tags: ["id order", "status", "setelah bayar", "qris"],
  },
  {
    id: "id-format",
    category: "order",
    question: "Format ID order kayak gimana?",
    answer: [
      "Format baru memakai 8 karakter acak, misalnya IMZ-ABCD1234.",
      "Ketik delapan karakter ID setelah awalan IMZ-. Contoh: IMZ-ABCD1234.",
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
      "Iya, stok berkurang otomatis setiap ada order baru.",
      "Kalo varian yang kamu mau habis, tunggu restock atau tanyain ke admin via WhatsApp.",
    ],
    tags: ["stok", "real-time", "checkout"],
  },
  {
    id: "warranty-policy",
    category: "support",
    question: "Garansi berlaku seperti apa?",
    answer: [
      "Masa garansi mengikuti label pada varian dan melindungi kendala akun sebelum masa paket berakhir.",
      "Laporkan kendala maksimal 24 jam setelah ditemukan, sertakan ID order, dan jangan mengubah data login untuk akun sharing.",
    ],
    tags: ["garansi", "replace", "kendala", "24 jam"],
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
    question: "Ada kendala, hubungi ke mana?",
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
    desc: "Simpan ID aman seperti IMZ-ABCD1234 yang muncul saat stok dikunci.",
    to: "/status",
  },
  {
    num: "04",
    icon: CircleCheck,
    title: "Pantau progress",
    desc: "Masukin ID di halaman Status - update real-time.",
    to: "/status",
  },
];

const CATEGORY_LABELS = Object.fromEntries(
  FAQ_CATEGORIES.filter((item) => item.key !== "all").map((item) => [item.key, item.label])
);

function faqMatches(item, query) {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  const blob = [item.question, ...item.answer, ...(item.tags || [])].join(" ").toLowerCase();
  return blob.includes(q);
}

function FaqItem({ item, open, onToggle, idPrefix = "faq" }) {
  const questionId = `${idPrefix}-question-${item.id}`;
  const answerId = `${idPrefix}-answer-${item.id}`;
  const categoryLabel = CATEGORY_LABELS[item.category] || "FAQ";

  return (
    <article className={`help-item${open ? " open" : ""}`}>
      <button
        type="button"
        className="help-itemHead"
        id={questionId}
        aria-controls={answerId}
        aria-expanded={open}
        onClick={() => onToggle(item.id)}
      >
        <span className="help-itemQuestion">
          <span className="help-itemCategory">{categoryLabel}</span>
          <span>{item.question}</span>
        </span>
        <ChevronDown size={17} />
      </button>

      <div id={answerId} className="help-itemBodyWrap" hidden={!open} role="region" aria-labelledby={questionId}>
        <div className="help-itemBody">
          {item.answer.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>
    </article>
  );
}

export default function FaqPageContent() {
  usePageMeta({
    title: "FAQ",
    description: "Jawaban cepet soal bayar, order, varian, & aktivasi - biar gak bingung.",
  });

  const [waNumber, setWaNumber] = useState("6283136049987");
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const [activeCategory, setActiveCategory] = useState("all");
  const [openId, setOpenId] = useState("");

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
    const context = query.trim() ? ` Saya tadi mencari: “${query.trim()}”.` : "";
    const message = encodeURIComponent(`Halo Admin Imzaqi Store, saya mau tanya terkait order/produk.${context}`);
    return `https://wa.me/${waNumber}?text=${message}`;
  }, [waNumber]);

  return (
    <div className="help-page">
      <div className="help-wrap">
        <header className="help-hero">
          <div className="help-heroCopy">
            <span className="help-eyebrow"><CircleHelp size={16} /> PUSAT BANTUAN</span>
            <h1>Biar jelas.<br /><span>Biar tenang.</span></h1>
            <p>Dari pilih paket sampai akun aktif. Temukan jawabanmu dan lanjut belanja tanpa bingung.</p>
            <div className="help-search">
              <Search size={21} aria-hidden="true" />
              <input value={query} onChange={(e) => handleQueryChange(e.target.value)} placeholder="Cari QRIS, promo, aktivasi…" aria-label="Cari FAQ" type="search" />
              {query && <button type="button" onClick={() => handleQueryChange("")} aria-label="Hapus pencarian"><X size={18} /></button>}
            </div>
            <div className="help-popular"><span>Sering dicari:</span>{["QRIS", "ID order", "email"].map(term => <button key={term} type="button" onClick={() => { handleQueryChange(term); setActiveCategory("all"); }}>{term}</button>)}</div>
          </div>
          <div className="help-heroAside">
            <span className="help-asideLabel">BELANJA LEBIH NYAMAN</span>
            <div className="help-heroSymbol" aria-hidden="true"><MessageCircle size={68} strokeWidth={1.4} /><span><CircleCheck size={26} /></span></div>
            <h2>Ada jawaban.<br />Ada yang bantu.</h2>
            <p>Cari panduan di sini, atau ngobrol langsung dengan admin.</p>
            <a className="hx-btn-primary" href={waUrl} target="_blank" rel="noreferrer">Tanya admin <ArrowUpRight size={18} /></a>
          </div>
        </header>

        {!query.trim() && activeCategory === "all" ? (
          <section className="help-popularAnswers" aria-labelledby="help-popular-title">
            <div className="help-listHead"><div><span className="help-eyebrow">PALING SERING DIBUTUHKAN</span><h2 id="help-popular-title">Jawaban cepat.</h2></div></div>
            <div className="help-list">{FAQ_ITEMS.slice(0, 3).map(item => <FaqItem key={item.id} item={item} idPrefix="popular-faq" open={item.id === openId} onToggle={handleToggle} />)}</div>
          </section>
        ) : null}

        <div className="help-workspace">
          <aside className="help-sidebar">
            <span className="help-eyebrow">JELAJAHI TOPIK</span>
            <div className="help-categories" role="group" aria-label="Filter kategori FAQ">
              {FAQ_CATEGORIES.map(category => <button key={category.key} type="button" aria-pressed={category.key === activeCategory} onClick={() => setActiveCategory(category.key)}><span>{category.label}</span>{" "}<span className="help-count">{categoryCounts[category.key] || 0}</span></button>)}
            </div>
            <Link className="help-orderLink" to="/status"><ClipboardList size={22} /><span><strong>Sudah punya order?</strong><small>Pantau status pesananmu</small></span><ArrowUpRight size={18} /></Link>
          </aside>
          <section className="help-answers" aria-labelledby="help-results-title">
            <div className="help-listHead"><div><span className="help-eyebrow">JAWABAN UNTUKMU</span><h2 id="help-results-title">{query.trim() ? "Hasil pencarian" : activeCategory === "all" ? "Pertanyaan yang sering ditanya" : CATEGORY_LABELS[activeCategory]}</h2></div><span className="help-resultCount" role="status">{filteredFaq.length} pertanyaan</span></div>
            {filteredFaq.length ? <div className="help-list">{filteredFaq.map(item => <FaqItem key={item.id} item={item} open={item.id === openId} onToggle={handleToggle} />)}</div> : <div className="help-empty"><PackageSearch size={38} /><h3>Jawabannya belum ketemu</h3><p>Coba kata kunci lain atau kirim pencarian ini ke admin.</p><button className="help-button" type="button" onClick={() => { handleQueryChange(""); setActiveCategory("all"); }}>Lihat semua pertanyaan</button><a className="help-button help-button--secondary" href={waUrl} target="_blank" rel="noreferrer">Tanya admin</a></div>}
          </section>
        </div>

        <section className="help-howto" aria-labelledby="help-howto-title">
          <div className="help-sectionHead"><div><span className="help-eyebrow">BARU PERTAMA BELANJA?</span><h2 id="help-howto-title">Dari pilih sampai siap pakai.</h2></div><Link to="/produk">Jelajahi produk <ArrowUpRight size={18} /></Link></div>
          <div className="help-steps">{HOWTO_STEPS.map(step => { const Icon = step.icon; return <div className="help-step" key={step.num}><div className="help-stepTop"><Icon size={23} /><span>{step.num}</span></div><h3>{step.title}</h3><p>{step.desc}</p></div>; })}</div>
        </section>

        <section className="help-support" aria-labelledby="help-support-title">
          <div className="help-supportIcon"><ShieldCheck size={30} /></div><div><span className="help-eyebrow">KAMI BANTU SAMPAI JELAS</span><h2 id="help-support-title">Masih ada yang mengganjal?</h2><p>Kirim ID order dan ceritakan kendalamu. Jangan bagikan password atau kode OTP saat meminta bantuan.</p></div><a className="help-button" href={waUrl} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Chat admin</a>
        </section>
      </div>
    </div>
  );
}
