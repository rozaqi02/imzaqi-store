import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { fetchTestimonials } from "../lib/api";
import EmptyState from "../components/EmptyState";
import { usePageMeta } from "../hooks/usePageMeta";

export default function Testimonials() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [view, setView] = useState("masonry"); // "masonry" | "grid"
  const [limit, setLimit] = useState(18);

  // Lightbox
  const [activeIdx, setActiveIdx] = useState(-1);

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
        setItems(Array.isArray(data) ? data : []);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(e);
        setError("Gagal memuat testimoni. Coba refresh.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((t) => {
      const cap = (t?.caption || "").toLowerCase();
      const url = (t?.image_url || "").toLowerCase();
      return cap.includes(s) || url.includes(s);
    });
  }, [items, q]);

  useEffect(() => {
    // reset pagination saat search / ganti view
    setLimit(18);
  }, [q, view]);

  const shown = useMemo(() => filtered.slice(0, limit), [filtered, limit]);
  const hasMore = shown.length < filtered.length;

  const total = items.length;

  // Keyboard control for lightbox
  useEffect(() => {
    function onKey(e) {
      if (activeIdx < 0) return;
      if (e.key === "Escape") setActiveIdx(-1);
      if (e.key === "ArrowLeft") setActiveIdx((i) => (i <= 0 ? filtered.length - 1 : i - 1));
      if (e.key === "ArrowRight") setActiveIdx((i) => (i >= filtered.length - 1 ? 0 : i + 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIdx, filtered.length]);

  const active = activeIdx >= 0 ? filtered[activeIdx] : null;

  return (
    <div className="page">
      <section className="section reveal testi-hero-premium">
        <div className="container center">
          <div className="testi-badge">
            <span aria-hidden="true">🧾</span>
            Testimoni Pelanggan
          </div>

          <h1 className="h1 testi-title-premium">
            Bukti real kalau belanja akun premium bisa{" "}
            <span className="hero-accent">aman & rapi</span>
          </h1>

          <p className="testi-sub-premium">
            Ini sebagian cerita pelanggan setelah checkout QRIS — bukti bayar diupload, status jelas, dan garansi jalan.
          </p>

          <div className="testi-metrics-premium">
            <div className="metric-card">
              <div className="metric-big">{total.toLocaleString("id-ID")}</div>
              <div className="metric-label">Total testimoni</div>
            </div>
            <div className="metric-card">
              <div className="metric-big">Real</div>
              <div className="metric-label">Upload admin</div>
            </div>
            <div className="metric-card">
              <div className="metric-big">Live</div>
              <div className="metric-label">Tampil real-time</div>
            </div>
          </div>

          <div className="testi-cta-row">
            <Link className="btn" to="/produk">Lihat Produk</Link>
            <Link className="btn btn-ghost" to="/status">Cek Status</Link>
          </div>
        </div>
      </section>

      <section className="section reveal">
        <div className="container">
          <div className="card pad testi-toolbar-premium">
            <div className="testi-toolbar-left">
              <div className="testi-search-wrap">
                <span className="testi-search-icon" aria-hidden="true">⌕</span>
                <input
                  className="input testi-search-input"
                  placeholder="Cari testimoni (caption / keyword)…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                {q ? (
                  <button type="button" className="testi-clear" onClick={() => setQ("")} aria-label="Clear">
                    ×
                  </button>
                ) : null}
              </div>

              <div className="muted" style={{ fontSize: 13 }}>
                Menampilkan <b>{shown.length.toLocaleString("id-ID")}</b> dari{" "}
                <b>{filtered.length.toLocaleString("id-ID")}</b>
              </div>
            </div>

            <div className="testi-toolbar-right">
              <button
                type="button"
                className={`tab-btn ${view === "masonry" ? "active" : ""}`}
                onClick={() => setView("masonry")}
              >
                Masonry
              </button>
              <button
                type="button"
                className={`tab-btn ${view === "grid" ? "active" : ""}`}
                onClick={() => setView("grid")}
              >
                Grid
              </button>
            </div>
          </div>

          {loading ? (
            <div className="testi-skel-grid">
              <div className="testi-skel" />
              <div className="testi-skel" />
              <div className="testi-skel" />
            </div>
          ) : error ? (
            <div className="card pad" style={{ marginTop: 14 }}>
              <EmptyState
                icon="📡"
                title="Testimoni belum bisa dimuat"
                description={error}
                primaryAction={{ label: "Refresh", onClick: () => window.location.reload() }}
                secondaryAction={{ label: "Kembali ke Home", to: "/" }}
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="card pad" style={{ marginTop: 14 }}>
              <EmptyState
                icon="🧾"
                title="Belum ada testimoni"
                description="Admin bisa upload dari dashboard. Kalau kamu sudah pernah beli, makasih banget ya 🙏"
                primaryAction={{ label: "Belanja dulu", to: "/produk" }}
                secondaryAction={{ label: "Cek Status Order", to: "/status" }}
              />
            </div>
          ) : (
            <>
              <div className={view === "masonry" ? "testi-masonry" : "testi-grid"}>
                {shown.map((t, idx) => {
                  const realIdx = idx; // karena shown adalah slice awal dari filtered
                  return (
                    <button
                      key={t.id}
                      className="testi-tile"
                      type="button"
                      onClick={() => setActiveIdx(realIdx)}
                      aria-label="Buka testimoni"
                    >
                      <div className="testi-img-wrap">
                        <img src={t.image_url} alt={t.caption || "testimoni"} loading="lazy" />
                        <div className="testi-hover">
                          <div className="testi-zoom">Klik untuk zoom</div>
                        </div>
                      </div>
                      {t.caption ? <div className="testi-caption">{t.caption}</div> : null}
                    </button>
                  );
                })}
              </div>

              {hasMore ? (
                <div className="testi-loadmore">
                  <button className="btn btn-ghost" type="button" onClick={() => setLimit((x) => x + 18)}>
                    Load more
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>

      {/* Lightbox */}
      <AnimatePresence>
        {active ? (
          <motion.div
            className="lightbox-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setActiveIdx(-1);
            }}
          >
            <motion.div
              className="lightbox"
              initial={{ opacity: 0, y: 10, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.985 }}
              transition={{ duration: 0.22 }}
            >
              <button className="lightbox-close" type="button" onClick={() => setActiveIdx(-1)} aria-label="Close">
                ×
              </button>

              {filtered.length > 1 ? (
                <>
                  <button
                    className="lightbox-nav prev"
                    type="button"
                    onClick={() => setActiveIdx((i) => (i <= 0 ? filtered.length - 1 : i - 1))}
                    aria-label="Previous"
                  >
                    ‹
                  </button>
                  <button
                    className="lightbox-nav next"
                    type="button"
                    onClick={() => setActiveIdx((i) => (i >= filtered.length - 1 ? 0 : i + 1))}
                    aria-label="Next"
                  >
                    ›
                  </button>
                </>
              ) : null}

              <div className="lightbox-body">
                <img className="lightbox-img" src={active.image_url} alt={active.caption || "testimoni"} />
                {active.caption ? <div className="lightbox-caption">{active.caption}</div> : null}
                <div className="lightbox-hint">ESC untuk tutup • ← → untuk navigasi</div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
