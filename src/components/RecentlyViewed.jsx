import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getRecentlyViewed } from "../lib/recentlyViewed";
import { formatIDR } from "../lib/format";
import "./RecentlyViewed.css";

export default function RecentlyViewed({ currentProductId }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const all = getRecentlyViewed();
    // Exclude current product if viewing a product page
    const filtered = currentProductId
      ? all.filter((p) => p.id !== currentProductId)
      : all;
    setItems(filtered.slice(0, 6));
  }, [currentProductId]);

  if (items.length === 0) return null;

  return (
    <section className="rv-strip" aria-label="Baru kamu lihat">
      <div className="rv-head">
        <span className="rv-label">Baru kamu lihat</span>
      </div>
      <div className="rv-list">
        {items.map((item) => (
          <Link
            key={item.id}
            to={`/produk/${item.slug}`}
            className="rv-card"
            aria-label={item.name}
          >
            <div className="rv-icon">
              {item.icon_url ? (
                <img src={item.icon_url} alt="" loading="lazy" width="32" height="32" />
              ) : (
                <span className="rv-fallback">{String(item.name || "P").slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div className="rv-info">
              <span className="rv-name">{item.name}</span>
              {item.minPrice ? (
                <span className="rv-price">{formatIDR(item.minPrice)}</span>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
