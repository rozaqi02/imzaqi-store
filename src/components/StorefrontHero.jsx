import React from "react";
import {
  History,
  PackageCheck,
  Search,
} from "lucide-react";

export function CatalogHero({
  loading,
  error,
  productCount,
  readyCount,
  onSearch,
  children,
  search,
}) {
  return (
    <header className="store-hero store-hero--catalog">
      <div className="store-heroCopy">
        <h1>Katalog Produk</h1>
        <p>Aplikasi premium dan layanan akademik siap pakai.</p>
        <div className="store-heroFacts" aria-label="Ringkasan katalog">
          <span><strong>{loading ? "…" : error ? "-" : productCount}</strong> produk</span>
          <span><strong>{loading ? "…" : error ? "-" : readyCount}</strong> varian tersedia</span>
        </div>
      </div>
      <div className="store-heroActions store-heroActions--search">
        {search || children || (
          <button className="hx-btn-primary" type="button" onClick={onSearch}>
            <Search size={15} aria-hidden="true" /> Cari paketmu
          </button>
        )}
      </div>
    </header>
  );
}

export function StatusHero({ history = false, hasOrder = false }) {
  return (
    <header className={`store-hero store-hero--status${hasOrder ? " store-hero--hasOrder" : ""}`}>
      <div className="store-heroCopy">
        <span className="store-heroEyebrow">
          {history ? <History size={14} aria-hidden="true" /> : <PackageCheck size={14} aria-hidden="true" />}
          {history ? "Riwayat Pesanan" : "Pantau Pesanan"}
        </span>
        <h1>
          {history ? (
            <>Pernah pesan? <span>Temukan lagi.</span></>
          ) : (
            <>Sudah pesan? <span>Cek sampai beres.</span></>
          )}
        </h1>
        <p>
          {history
            ? "Riwayat order di perangkat ini."
            : "Cek perkembangan order dan data akun dari admin."}
        </p>
      </div>
    </header>
  );
}
