import React from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, Compass, Grid2x2, History, Home } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";

const QUICK_LINKS = [
  { to: "/", label: "Home", icon: Home, desc: "Balik ke beranda" },
  { to: "/produk", label: "Produk", icon: Grid2x2, desc: "Lihat semua katalog" },
  { to: "/status", label: "Status Order", icon: Activity, desc: "Cek progress order kamu" },
  { to: "/status?tab=riwayat", label: "Riwayat", icon: History, desc: "Order dari browser ini" },
];

export default function NotFound() {
  usePageMeta({
    title: "404 — Halaman Tidak Ditemukan",
    description: "Halaman ini nggak ada. Coba pilih halaman lain ya.",
  });

  return (
    <div className="page nf-page">
      <section className="section">
        <div className="container">
          <div className="nf-shell">
            <div className="nf-hero">
              <div className="nf-radar">
                <Compass size={32} />
              </div>
              <div className="nf-code">404</div>
              <h1 className="nf-title">Halaman hilang nih</h1>
              <p className="nf-sub">
                Link-nya nggak ada atau udah dipindah.
                Pilih salah satu halaman di bawah ya.
              </p>
            </div>

            <div className="nf-links">
              {QUICK_LINKS.map((link) => {
                const Icon = link.icon;
                return (
                  <Link key={link.to} to={link.to} className="nf-linkCard">
                    <span className="nf-linkIcon">
                      <Icon size={20} />
                    </span>
                    <div className="nf-linkCopy">
                      <strong>{link.label}</strong>
                      <small>{link.desc}</small>
                    </div>
                    <ArrowRight size={16} className="nf-linkArrow" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
