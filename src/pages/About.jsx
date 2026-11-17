import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock, MessageCircle, QrCode, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import { STORE_WHATSAPP } from "../lib/productCategories";
import "../css/pages/About.css";

const PILLARS = [
  {
    icon: Zap,
    title: "Proses Cepat 5–15 Menit",
    desc: "Pesanan yang sudah dibayar via QRIS dan dilaporkan langsung masuk antrean admin saat jam operasional.",
  },
  {
    icon: ShieldCheck,
    title: "Garansi Resmi Sesuai Paket",
    desc: "Setiap varian mencantumkan durasi, ketentuan penggunaan, dan cakupan garansi secara transparan sebelum checkout.",
  },
  {
    icon: QrCode,
    title: "QRIS & Pelacakan Real-Time",
    desc: "Kode pesanan dan ID transaksi tercatat rapi supaya kamu bisa memantau status kapan saja dari halaman Status.",
  },
];

export default function About() {
  usePageMeta({
    title: "Tentang Toko",
    description: "Profil resmi imzaqi.store: komitmen harga pelajar, garansi transparan, dan alur pemesanan QRIS yang jelas.",
  });

  const waUrl = `https://wa.me/${STORE_WHATSAPP.app_premium}?text=${encodeURIComponent("Halo Admin imzaqi.store, saya ingin bertanya seputar produk dan garansi.")}`;

  return (
    <div className="about-page">
      <div className="container about-shell">
        <header className="about-hero">
          <span className="about-kicker">
            <Sparkles size={13} aria-hidden="true" /> Profil Toko Resmi
          </span>
          <h1 className="about-title">Akses aplikasi premium & layanan digital ramah pelajar.</h1>
          <p className="about-sub">
            imzaqi.store dikelola langsung dengan standar layanan yang jelas: harga jujur tanpa biaya tersembunyi,
            instruksi aktivasi terstruktur, dan dukungan garansi sesuai paket yang kamu pilih.
          </p>
          <div className="about-actions">
            <Link className="btn btn-primary" to="/produk">
              Lihat Katalog <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <Link className="btn btn-ghost" to="/faq">
              Baca FAQ & Garansi
            </Link>
          </div>
        </header>

        <section className="about-grid" aria-label="Standar layanan">
          {PILLARS.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="about-card">
                <div className="about-cardIcon" aria-hidden="true">
                  <Icon size={20} />
                </div>
                <h2>{item.title}</h2>
                <p>{item.desc}</p>
              </article>
            );
          })}
        </section>

        <section className="about-slaPanel" aria-label="Jam operasional dan kontak">
          <div className="about-slaCopy">
            <strong>Jam Operasional & Verifikasi Pembayaran</strong>
            <span>Order masuk di luar jam layanan tetap aman tersimpan dan diproses di antrean paling awal.</span>
          </div>
          <div className="about-slaMeta">
            <span className="about-metaPill">
              <Clock size={14} aria-hidden="true" /> 08.00 – 22.00 WIB
            </span>
            <a className="btn btn-ghost" href={waUrl} target="_blank" rel="noreferrer">
              <MessageCircle size={15} aria-hidden="true" /> Hubungi Admin
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
