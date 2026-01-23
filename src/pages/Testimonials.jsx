import React, { useEffect, useState } from "react";
import { fetchTestimonials } from "../lib/api";

export default function Testimonials() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetchTestimonials();
        if (!alive) return;
        setItems(data);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="page">
      <section className="section reveal">
        <div className="container section-head">
          <div>
            <h1 className="h1">Testimoni</h1>
            <p className="muted">Gambar testimoni diinput admin dan tampil real-time.</p>
          </div>
        </div>

        {loading ? (
          <div className="container grid-3">
            <div className="skeleton card tall" />
            <div className="skeleton card tall" />
            <div className="skeleton card tall" />
          </div>
        ) : items.length === 0 ? (
          <div className="container hint">Belum ada testimoni. Admin bisa upload dari dashboard.</div>
        ) : (
          <div className="container masonry">
            {items.map(t => (
              <figure key={t.id} className="masonry-item">
                <img src={t.image_url} alt={t.caption || "testimoni"} loading="lazy" />
                {t.caption ? <figcaption>{t.caption}</figcaption> : null}
              </figure>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
