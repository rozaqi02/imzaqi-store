import React from "react";
import { Link } from "react-router-dom";

const metaLinks = [
  { label: "QRIS", to: "/tentang" },
  { label: "ID order", to: "/status" },
  { label: "WA admin", href: "https://wa.me/6283136049987" },
];

const footerGroups = [
  {
    label: "Menu",
    to: "/produk",
    links: [
      { label: "Home", to: "/" },
      { label: "Produk", to: "/produk" },
      { label: "Status", to: "/status" },
    ],
  },
  {
    label: "Bantuan",
    to: "/tentang",
    links: [
      { label: "Tentang", to: "/tentang" },
      { label: "Testimoni", to: "/testimoni" },
      { label: "Hubungi admin", href: "https://wa.me/6283136049987" },
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
    <footer className="site-footer">
      <div className="container">
        <div className="site-footerPanel">
          <div className="site-footerTop">
            <div className="site-footerIntro">
              <Link className="site-footerBadge" to="/">
                imzaqi.store
              </Link>

              <div className="site-footerBrand">
                <Link to="/produk" aria-label="Buka katalog produk">
                  <img src="/imzaqistore_logo.png" alt="imzaqi.store" />
                </Link>

                <div className="site-footerBrandCopy">
                  <Link className="site-footerHeadline" to="/produk">
                    Digital goods, tanpa ribet.
                  </Link>
                  <Link className="site-footerLead" to="/tentang">
                    Pilih paket. Bayar. Simpan ID.
                  </Link>
                </div>
              </div>
            </div>

            <div className="site-footerActions">
              <Link className="btn" to="/produk">
                Lihat katalog
              </Link>
              <a className="btn btn-ghost" href="https://wa.me/6283136049987" target="_blank" rel="noreferrer">
                Hubungi admin
              </a>
            </div>
          </div>

          <div className="site-footerMeta">
            {metaLinks.map((item) => (
              <FooterLink key={item.label} item={item} />
            ))}
          </div>

          <div className="site-footerGrid">
            {footerGroups.map((group) => (
              <div key={group.label} className="site-footerCol">
                <Link className="site-footerLabel" to={group.to}>
                  {group.label}
                </Link>
                <div className="site-footerList">
                  {group.links.map((item) => (
                    <FooterLink key={item.label} item={item} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="site-footerBottom">
            <Link to="/">Copyright {year} imzaqi.store</Link>
            <a href="tel:+6283136049987">0831-3604-9987</a>
            <Link to="/status">Cek status</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
