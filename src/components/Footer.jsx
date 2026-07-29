import React from "react";
import { Link } from "react-router-dom";

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
      { label: "Bayar", to: "/checkout" },
      { label: "Cek Status", to: "/status" },
      { label: "Riwayat Order", to: "/status?tab=riwayat" },
    ],
  },
];

function FooterLink({ item, className = "" }) {
  if (item.href) {
    return (
      <a className={className} href={item.href} target="_blank" rel="noreferrer">
        {item.label}
      </a>
    );
  }

  return (
    <Link className={className} to={item.to}>
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
              <a href="https://wa.me/6282245964007" target="_blank" rel="noreferrer" className="site-footerGoContact-wa">
                📱 +62 822-4596-4007 <span style={{ opacity: 0.75, fontSize: "12px", fontWeight: 600 }}>(Khusus App Premium)</span>
              </a>
              <a href="https://wa.me/6281232742374" target="_blank" rel="noreferrer" className="site-footerGoContact-wa">
                🎓 +62 812-3274-2374 <span style={{ opacity: 0.75, fontSize: "12px", fontWeight: 600 }}>(Khusus Jasa Akademik)</span>
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
            <p>© {year} imzaqi.store. Hak cipta dilindungi. • imzaqi store v5.5.0</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
