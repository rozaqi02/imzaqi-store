import React from "react";

export default function Header() {
  return (
    <header className="header">
      <div className="container header-inner">
        <div className="brand">
          <div className="logo">i</div>
          <div>
            <div className="brand-name">imzaqi.store</div>
            <div className="brand-sub">Digital subscription store</div>
          </div>
        </div>

        <nav className="nav">
          <a href="#produk">Produk</a>
          <a href="#cara-beli">Cara Beli</a>
          <a href="#faq">FAQ</a>
        </nav>
      </div>
    </header>
  );
}
