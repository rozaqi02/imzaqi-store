import React from "react";
import { Link, useLocation } from "react-router-dom";
import { STORE_WHATSAPP } from "../lib/productCategories";
import { useIsMobile } from "../hooks/useIsMobile";

const footerColumns = [
  {
    label: "Navigasi",
    links: [
      { label: "Beranda", to: "/" },
      { label: "Katalog", to: "/produk" },
      { label: "Ulasan", to: "/testimoni" },
      { label: "Bantuan", to: "/faq" },
      { label: "Media Promosi", to: "/promosi" },
    ],
  },
  {
    label: "Order",
    links: [
      { label: "Checkout", to: "/checkout", overlay: true },
      { label: "Cek Status", to: "/status" },
      { label: "Riwayat Pesanan", to: "/status?tab=riwayat" },
    ],
  },
  {
    label: "Kebijakan",
    links: [
      { label: "Syarat & Ketentuan", to: "/faq?q=syarat" },
      { label: "Ketentuan Garansi", to: "/faq?q=garansi" },
      { label: "Kebijakan Privasi", to: "/faq?q=privasi" },
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
      state={item.overlay && location.pathname !== "/checkout" ? { backgroundLocation: location } : undefined}
    >
      {item.label}
    </Link>
  );
}

export default function Footer() {
  const year = new Date().getFullYear();
  const isMobile = useIsMobile("(max-width: 767px)");

  return (
    <footer className="site-footer site-footer--gopay">
      <div className="container">
        <div className="site-footerPanel site-footerGo">
          <div className="site-footerGoIntro">
            <Link className="site-footerGoBrand" to="/" aria-label="Kembali ke beranda">
              <img src="/imzaqistore_logo.png" alt="imzaqi.store" />
              <span>imzaqi.store</span>
            </Link>
          </div>

          <div className="site-footerGoColumns">
            {footerColumns.map((group) => (
              <details key={`${group.label}-${isMobile ? "m" : "d"}`} className="site-footerGoCol" open={!isMobile}>
                <summary className="site-footerGoTitle">{group.label}</summary>
                <div className="site-footerGoList">
                  {group.links.map((item) => (
                    <FooterLink key={`${group.label}-${item.label}`} item={item} className="site-footerGoLink" />
                  ))}
                </div>
              </details>
            ))}

            <details key={`bantuan-${isMobile ? "m" : "d"}`} className="site-footerGoCol" open={!isMobile}>
              <summary className="site-footerGoTitle">Bantuan & Kontak</summary>
              <div className="site-footerGoList">
                <Link className="site-footerGoLink" to="/faq?q=paket">
                  Cara Pesan
                </Link>
                <Link className="site-footerGoLink" to="/faq?q=QRIS">
                  Cara Bayar QRIS
                </Link>
                <Link className="site-footerGoLink" to="/faq">
                  Pusat Bantuan
                </Link>
                <a
                  className="site-footerGoLink"
                  href={`https://wa.me/${STORE_WHATSAPP.app_premium}?text=${encodeURIComponent("Halo Admin imzaqi.store, saya butuh bantuan.")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp Resmi (+{STORE_WHATSAPP.app_premium})
                </a>
                <span className="site-footerGoLink" style={{ opacity: 0.8, cursor: "default", fontSize: "13px" }}>
                  Jam Buka: 08.00–22.00 WIB
                </span>
              </div>
            </details>
          </div>

          <div className="site-footerGoLegal">
            <p>Bayar QRIS, pantau status 24 jam.</p>
            <p>© {year} imzaqi.store</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
