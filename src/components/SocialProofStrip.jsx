import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { fetchTestimonials } from "../lib/api";
import "./SocialProofStrip.css";

export default function SocialProofStrip({ limit = 3, title = "Dipercaya pembeli lain" }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let alive = true;
    fetchTestimonials({ useCache: true })
      .then((rows) => { if (alive) setItems((rows || []).slice(0, limit)); })
      .catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [limit]);

  if (!items.length) return null;

  return (
    <div className="social-proof-strip" aria-label={title}>
      <div className="social-proof-head"><Star size={14} /><span>{title}</span></div>
      <div className="social-proof-list">
        {items.map((item) => (
          <figure key={item.id} className="social-proof-card">
            {item.image_url ? <img src={item.image_url} alt="" loading="lazy" /> : null}
            <figcaption>{item.caption || "Pembeli puas"}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
