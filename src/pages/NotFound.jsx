import React from "react";
import { Link } from "react-router-dom";

export default function NotFound() {
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
