import React from "react";
import { Link } from "react-router-dom";
import { usePageMeta } from "../hooks/usePageMeta";

export default function NotFound() {
  usePageMeta({ title: "404", description: "Halaman tidak ditemukan." });
  return (
    <div className="page">
      <section className="section">
        <div className="container center">
          <h1 className="h1">404</h1>
          <p className="muted">Halaman tidak ditemukan.</p>
          <Link className="btn" to="/">Kembali ke Home</Link>
        </div>
      </section>
    </div>
  );
}
