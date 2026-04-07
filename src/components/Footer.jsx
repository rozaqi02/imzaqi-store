import React from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Phone, ReceiptText, ScanLine } from "lucide-react";

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

const mobileQuickLinks = [
  { label: "QRIS", helper: "cara bayar", to: "/tentang", icon: ScanLine },
  { label: "Status", helper: "cek order", to: "/status", icon: ReceiptText },
  { label: "WhatsApp", helper: "hubungi admin", href: "https://wa.me/6283136049987", icon: MessageCircle },
  { label: "Telepon", helper: "0831-3604-9987", href: "tel:+6283136049987", icon: Phone },
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

function FooterQuickLink({ item }) {
  const Icon = item.icon;
  const content = (
    <>
      <span className="site-footerQuickIcon">
        <Icon size={18} />
      </span>
      <span className="site-footerQuickCopy">
        <strong>{item.label}</strong>
        <span>{item.helper}</span>
      </span>
    </>
  );

  if (item.href) {
    return (
      <a className="site-footerQuickLink" href={item.href} target="_blank" rel="noreferrer">
        {content}
      </a>
    );
  }

  return (
    <Link className="site-footerQuickLink" to={item.to}>
      {content}
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

          <div className="site-footerQuickGrid">
            {mobileQuickLinks.map((item) => (
              <FooterQuickLink key={item.label} item={item} />
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
            <Link className="site-footerBottomMain" to="/">
              Copyright {year} imzaqi.store
            </Link>
            <a className="site-footerBottomItem" href="tel:+6283136049987">
              0831-3604-9987
            </a>
            <Link className="site-footerBottomItem" to="/status">
              Cek status
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
