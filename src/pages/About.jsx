import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown,
  CreditCard,
  ShieldCheck,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";

const FAQ = [
  {
    q: "Flow beli?",
    a: "Pilih paket, bayar QRIS, upload bukti, lalu pantau status.",
  },
  {
    q: "Garansi?",
    a: "Ikut varian yang dipilih. Detail selalu tampil di paket.",
  },
  {
    q: "Proses?",
    a: "Tergantung antrean, tapi status order selalu jadi pusat info.",
  },
  {
    q: "Kendala?",
    a: "Admin bisa dihubungi via jalur bantuan yang tersedia di store.",
  },
];

export default function About() {
  usePageMeta({
    title: "Tentang",
    description: "Flow, nilai utama, dan FAQ Imzaqi Store.",
  });

  const [openIdx, setOpenIdx] = useState(0);

  const values = useMemo(
    () => [
      {
        icon: Sparkles,
        title: "Simple",
        text: "Sedikit klik. Sedikit bingung.",
      },
      {
        icon: ShieldCheck,
        title: "Clear",
        text: "Harga, paket, dan status terlihat.",
      },
      {
        icon: Zap,
        title: "Fast",
        text: "Checkout dan upload dalam satu alur.",
      },
    ],
    []
  );

  const flow = useMemo(
    () => [
      {
        icon: Workflow,
        num: "01",
        title: "Pilih",
        text: "Cari produk dan paket.",
      },
      {
        icon: CreditCard,
        num: "02",
        title: "Bayar",
        text: "QRIS lalu upload bukti.",
      },
      {
        icon: ShieldCheck,
        num: "03",
        title: "Pantau",
        text: "Cek status dengan order code.",
      },
    ],
    []
  );

  return (
    <div className="page">
      <section className="section about-minimal-hero reveal">
        <div className="container center">
          <h1 className="h1 about-minimal-title">
            Beli premium apps tanpa teks panjang.
          </h1>

          <p className="about-minimal-sub">Pilih. Bayar. Upload. Pantau.</p>

          <div className="about-miniStats">
            <div className="about-miniStat">
              <strong>QRIS</strong>
              <span>fast pay</span>
            </div>
            <div className="about-miniStat">
              <strong>Status</strong>
              <span>track live</span>
            </div>
            <div className="about-miniStat">
              <strong>Garansi</strong>
              <span>sesuai paket</span>
            </div>
          </div>

          <div className="about-miniCta">
            <Link className="btn" to="/produk">
              Lihat Produk
            </Link>
            <Link className="btn btn-ghost" to="/status">
              Cek Status
            </Link>
          </div>
        </div>
      </section>

      <section className="section reveal">
        <div className="container">
          <div className="about-valuesGrid">
            {values.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="about-valueCard card pad">
                  <span className="about-valueIcon">
                    <Icon size={18} />
                  </span>
                  <h2 className="h3">{item.title}</h2>
                  <p>{item.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section reveal">
        <div className="container">
          <div className="about-flowHead">
            <div className="about-sectionBadge">Flow</div>
            <h2 className="h2">Cara kerja</h2>
          </div>

          <div className="about-flowGrid">
            {flow.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.num} className="about-flowCard">
                  <div className="about-flowTop">
                    <span className="about-flowNum">{item.num}</span>
                    <span className="about-flowIcon">
                      <Icon size={18} />
                    </span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section reveal">
        <div className="container">
          <div className="about-flowHead">
            <div className="about-sectionBadge">FAQ</div>
            <h2 className="h2">Singkat</h2>
          </div>

          <div className="about-faqStack">
            {FAQ.map((item, idx) => {
              const open = idx === openIdx;
              return (
                <button
                  key={item.q}
                  type="button"
                  className={`about-faqItem ${open ? "open" : ""}`}
                  onClick={() => setOpenIdx(open ? -1 : idx)}
                  aria-expanded={open}
                >
                  <div className="about-faqHead">
                    <span>{item.q}</span>
                    <ChevronDown size={16} />
                  </div>
                  {open ? <div className="about-faqBody">{item.a}</div> : null}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section reveal">
        <div className="container">
          <div className="about-finalCard card pad center">
            <div className="about-sectionBadge">Ready</div>
            <h2 className="h2">Langsung mulai</h2>
            <div className="about-miniCta">
              <Link className="btn" to="/produk">
                Belanja
              </Link>
              <Link className="btn btn-ghost" to="/testimoni">
                Testimoni
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
