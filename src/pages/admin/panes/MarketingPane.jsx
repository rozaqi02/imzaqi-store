import React from "react";
import MarketingMediaGenerator from "../components/MarketingMediaGenerator";

/**
 * Presentational pane: Media & Generator Promosi.
 * Diekstrak dari AdminDashboard.jsx — data (products, settings) tetap di container.
 */
export default function MarketingPane({ products, settings }) {
  return (
    <div className="admin-panel admin-panel--fill admin-marketingPanel">
      <div className="admin-panel-head">
        <div>
          <div className="admin-panel-title">Media & Generator Promosi</div>
          <div className="admin-panel-sub">
            Studio poster produk dan katalog harga. Pilih desain, sesuaikan paket, lalu download PNG atau salin gambar.
          </div>
        </div>
      </div>
      <div className="admin-panel-body admin-panel-body--scroll">
        <MarketingMediaGenerator products={products} settings={settings} />
      </div>
    </div>
  );
}
