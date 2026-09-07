import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight, Check, ClipboardList, History,
  Layers3, PackageCheck, Search,
} from "lucide-react";
import "../css/support-surfaces.css";
import "./StorefrontHero.css";

function CatalogProductStack({ products }) {
  const preferred = ["netflix", "spotify", "canva", "youtube", "gemini"];
  const available = products.filter(product => product.is_active !== false && product.icon_url);
  const icons = [...available].sort((a, b) => {
    const rank = product => { const index = preferred.findIndex(name => String(product.slug).includes(name)); return index < 0 ? preferred.length : index; };
    return rank(a) - rank(b);
  }).slice(0, 5);
  if (!icons.length) return null;
  return <div className="catalog-productStack" aria-hidden="true">
    {icons.map((product, index) => <div className={`catalog-stackCard catalog-stackCard--${index + 1}`} key={product.id}>
      <img className={/canva|gemini/i.test(product.slug || "") ? "catalog-stackIcon--rounded" : undefined} src={product.icon_url} alt="" width="52" height="52" decoding="async" onError={event => { event.currentTarget.style.display = "none"; }} />
    </div>)}
  </div>;
}

export function CatalogHero({
  loading,
  error,
  productCount,
  readyCount,
  onSearch,
  products = [],
  children,
  search,
}) {
  return (
    <header className="store-hero store-hero--catalog">
      <div className="store-heroCopy">
        <span className="store-heroEyebrow"><Layers3 size={16} /> KATALOG</span>
        <h1>Pilih paket <span>andalanmu.</span></h1>
        <p>Aplikasi premium & layanan untuk kebutuhanmu.</p>
        <div className="store-heroFacts" aria-label="Ringkasan katalog">
          <span><strong>{loading ? "…" : error ? "—" : productCount}</strong> produk</span>
          <span><strong>{loading ? "…" : error ? "—" : readyCount}</strong> varian tersedia</span>
        </div>
      </div>
      <div className="store-heroStackClip" aria-hidden="true">
        <CatalogProductStack products={products} />
      </div>
      <div className="store-heroActions store-heroActions--search">
        {search || children || (
          <button className="hx-btn-primary" type="button" onClick={onSearch}>
            <Search size={15} /> Cari paketmu <ArrowUpRight size={15} />
          </button>
        )}
      </div>
    </header>
  );
}

export function StatusHero({ history = false }) {
  return (
    <header className="store-hero store-hero--status">
      <div className="store-heroCopy">
        <span className="store-heroEyebrow">{history ? <History size={16} /> : <PackageCheck size={16} />} {history ? "RIWAYAT PESANAN" : "PANTAU PESANANMU"}</span>
        <h1>{history ? <>Pernah pesan?<br /><span>Temukan lagi.</span></> : <>Sudah pesan?<br /><span>Cek sampai beres.</span></>}</h1>
        <p>{history ? "Lihat kembali order yang tersimpan di browser ini. Pilih pesanan untuk mengecek status terbarunya." : "Masukkan ID order untuk melihat perkembangan pesanan, detail pembayaran, dan informasi dari admin."}</p>
        <div className="store-heroActions"><Link className="hx-btn-primary" to="/faq">Butuh panduan order? <ArrowUpRight size={17} /></Link></div>
        <div className="store-statusTip"><ClipboardList size={18} /><span>{history ? "Riwayat mengikuti browser dan perangkat yang kamu gunakan." : "Siapkan ID order dari halaman konfirmasi pembayaran."}</span></div>
      </div>
      <div className="store-statusArt">
        <span className="store-artLabel">{history ? "CARA LIHAT RIWAYAT" : "CEK ORDER DALAM 3 LANGKAH"}</span>
        <ol className="store-guideSteps">
          {(history ? [["Buka riwayat", "Order tersimpan di browser ini."], ["Pilih pesanan", "Temukan order yang ingin dicek."], ["Lihat status", "Buka detail perkembangan order."]] : [["Siapkan ID order", "Salin dari konfirmasi pesanan."], ["Masukkan kode", "Gunakan kolom di bawah."], ["Lihat status", "Cek perkembangan pesananmu."]]).map(([title, text], index) => (
            <li key={title}><span className="store-guideNumber" aria-hidden="true">{index === 2 ? <Check size={18} /> : `0${index + 1}`}</span><div><strong>{title}</strong><span>{text}</span></div></li>
          ))}
        </ol>
      </div>
    </header>
  );
}
