import React, { useEffect, useState } from "react";
import { fetchTestimonials } from "../lib/api";
import EmptyState from "../components/EmptyState";
import { usePageMeta } from "../hooks/usePageMeta";

export default function Testimonials() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  usePageMeta({
    title: "Testimoni",
    description: "Testimoni pelanggan Imzaqi Store. Admin upload real-time dari dashboard.",
  });

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
        setError("Gagal memuat testimoni. Coba refresh.");
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
        ) : error ? (
          <div className="container">
            <div className="card pad">
              <EmptyState
                icon="📡"
                title="Testimoni belum bisa dimuat"
                description={error}
                primaryAction={{ label: "Refresh", onClick: () => window.location.reload() }}
                secondaryAction={{ label: "Kembali ke Home", to: "/" }}
              />
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="container">
            <div className="card pad">
              <EmptyState
                icon="🧾"
                title="Belum ada testimoni"
                description="Admin bisa upload dari dashboard. Kalau kamu sudah pernah beli, makasih banget ya 🙏"
                primaryAction={{ label: "Belanja dulu", to: "/produk" }}
                secondaryAction={{ label: "Cek Status Order", to: "/status" }}
              />
            </div>
          </div>
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
