import React from "react";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>© {year} imzaqi-store</div>
        <div className="footer-links">
          <a href="#faq">FAQ</a>
          <a href="#cara-beli">Cara Beli</a>
        </div>
      </div>
    </footer>
  );
}
