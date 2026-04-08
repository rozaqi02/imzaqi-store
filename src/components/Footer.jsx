import React from "react";
import { Link } from "react-router-dom";

const footerColumns = [
  {
    label: "Produk",
    links: [
      { label: "Home", to: "/" },
      { label: "Produk", to: "/produk" },
      { label: "Checkout", to: "/checkout" },
      { label: "Status", to: "/status" },
    ],
  },
  {
    label: "Merchant",
    links: [
      { label: "Hubungi Admin", href: "https://wa.me/6283136049987" },
      { label: "Cara Bayar QRIS", to: "/tentang" },
      { label: "Testimoni", to: "/testimoni" },
      { label: "Promo", to: "/produk" },
    ],
  },
  {
    label: "Perusahaan",
    links: [
      { label: "FAQ", to: "/tentang" },
      { label: "Panduan", to: "/tentang" },
      { label: "Media Kit", to: "/tentang" },
      { label: "Karier", to: "/tentang" },
    ],
  },
  {
    label: "Lainnya",
    links: [
      { label: "Bantuan", to: "/tentang" },
      { label: "Blog", to: "/tentang" },
      { label: "Hubungi Kami", href: "https://wa.me/6283136049987" },
      { label: "Kebijakan Privasi", to: "/tentang" },
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
        <div className="site-footerPanel site-footerGo">
          <div className="site-footerGoIntro">
            <Link className="site-footerGoBrand" to="/produk" aria-label="Buka katalog produk">
              <img src="/imzaqistore_logo.png" alt="imzaqi.store" />
              <span>imzaqi.store</span>
            </Link>

            <div className="site-footerGoContact">
              <a href="https://wa.me/6283136049987" target="_blank" rel="noreferrer">
                Call Center: 0831-3604-9987
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

          </div>

          <div className="site-footerGoLegal">
            <p>Imzaqi Store berfokus pada alur simpel: pilih produk, bayar, simpan ID, lalu pantau status order.</p>
            <p>(c) {year} imzaqi.store. All Rights Reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
