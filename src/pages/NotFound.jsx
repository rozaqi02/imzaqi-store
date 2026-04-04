import React from "react";
import { Link } from "react-router-dom";
import { Compass, Home, Search } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";

export default function NotFound() {
  usePageMeta({ title: "404", description: "Halaman tidak ditemukan." });

  return (
    <div className="page">
      <section className="section">
        <div className="container">
          <div className="nf-shell card pad center">
            <div className="nf-radar">
              <Compass size={26} />
            </div>
            <div className="nf-code">404</div>
            <h1 className="h2">Halaman tidak ada</h1>
            <p className="nf-sub">Lanjut dari katalog atau kembali ke halaman utama.</p>
            <div className="nf-actions">
              <Link className="btn" to="/">
                <Home size={16} />
                <span>Home</span>
              </Link>
              <Link className="btn btn-ghost" to="/produk">
                <Search size={16} />
                <span>Produk</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
