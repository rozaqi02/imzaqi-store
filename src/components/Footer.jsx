import React from "react";
import { Link, useLocation } from "react-router-dom";
import { GraduationCap, Smartphone } from "lucide-react";
import { STORE_WHATSAPP } from "../lib/productCategories";

const footerColumns = [
  {
    label: "Navigasi",
    links: [
      { label: "Beranda", to: "/" },
      { label: "Produk", to: "/produk" },
      { label: "Testimoni", to: "/testimoni" },
      { label: "FAQ", to: "/faq" },
    ],
  },
  {
    label: "Order",
    links: [
      { label: "Bayar", to: "/checkout", overlay: true },
      { label: "Cek Status", to: "/status" },
      { label: "Riwayat Order", to: "/status?tab=riwayat" },
    ],
  },
];

function FooterLink({ item, className = "" }) {
  const location = useLocation();
  if (item.href) {
    return (
      <a className={className} href={item.href} target="_blank" rel="noreferrer">
        {item.label}
      </a>
    );
  }

  return (
    <Link
      className={className}
      to={item.to}
      state={item.overlay ? { backgroundLocation: location } : undefined}
    >
      {item.label}
    </Link>
  );
}

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer site-footer--gopay">
      <div className="container">
        <div className="site-footerPanel site-footerGo reveal">
          <div className="site-footerGoIntro">
            <Link className="site-footerGoBrand" to="/" aria-label="Kembali ke beranda">
              <img src="/imzaqistore_logo.png" alt="imzaqi.store" />
              <span>imzaqi.store</span>
            </Link>

            <div className="site-footerGoContact">
              <a href={`https://wa.me/${STORE_WHATSAPP.app_premium}`} target="_blank" rel="noreferrer" className="site-footerGoContact-wa">
                <span className="site-footerGoContactIcon" aria-hidden="true"><Smartphone size={16} /></span>
                <span className="site-footerGoContactCopy">
                  <strong>+62 831-3604-9987</strong>
                  <small>Khusus App Premium</small>
                </span>
              </a>
              <a href={`https://wa.me/${STORE_WHATSAPP.academic}`} target="_blank" rel="noreferrer" className="site-footerGoContact-wa">
                <span className="site-footerGoContactIcon" aria-hidden="true"><GraduationCap size={16} /></span>
                <span className="site-footerGoContactCopy">
                  <strong>+62 812-3274-2374</strong>
                  <small>Khusus Jasa Akademik</small>
                </span>
              </a>
            </div>
          </div>

          <div className="site-footerGoColumns">
            {footerColumns.map((group) => (
              <div key={group.label} className="site-footerGoCol">
                <h3 className="site-footerGoTitle">{group.label}</h3>
                <div className="site-footerGoList">
                  {group.links.map((item) => (
                    <FooterLink key={`${group.label}-${item.label}`} item={item} className="site-footerGoLink" />
                  ))}
                </div>
              </div>
            ))}

            <div className="site-footerGoCol">
              <h3 className="site-footerGoTitle">Bantuan</h3>
              <div className="site-footerGoList">
                <Link className="site-footerGoLink" to="/faq">
                  Cara Pesan
                </Link>
                <Link className="site-footerGoLink" to="/faq">
                  Cara Bayar QRIS
                </Link>
                <Link className="site-footerGoLink" to="/faq">
                  FAQ Lengkap
                </Link>
              </div>
            </div>
          </div>

          <div className="site-footerGoLegal">
            <p>Imzaqi Store. Pilih produk, bayar QRIS, simpan ID, pantau status. Simpel banget.</p>
            <p>© {year} imzaqi.store. Hak cipta dilindungi. • imzaqi store v5.6.0</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
