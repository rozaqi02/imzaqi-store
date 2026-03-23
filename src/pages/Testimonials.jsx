import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Grid2x2,
  LayoutGrid,
  Search,
  X,
} from "lucide-react";
import { fetchTestimonials } from "../lib/api";
import EmptyState from "../components/EmptyState";
import { usePageMeta } from "../hooks/usePageMeta";

export default function Testimonials() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [view, setView] = useState("masonry");
  const [limit, setLimit] = useState(18);
  const [activeIdx, setActiveIdx] = useState(-1);

  usePageMeta({
    title: "Testimoni",
    description: "Bukti order pelanggan Imzaqi Store.",
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetchTestimonials();
        if (!alive) return;
        setItems(Array.isArray(data) ? data : []);
      } catch (e) {
        console.warn(e);
        setError("Gagal memuat testimoni.");
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
    setLimit(18);
  }, [q, view]);

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

  const shown = useMemo(() => filtered.slice(0, limit), [filtered, limit]);
  const hasMore = shown.length < filtered.length;
  const active = activeIdx >= 0 ? filtered[activeIdx] : null;

  return (
    <div className="page">
      <section className="section reveal testi-minimal-hero">
        <div className="container center">
          <h1 className="h1 testi-minimal-title">Real screenshots. Quick scan.</h1>
          <p className="testi-minimal-sub">Tap untuk zoom.</p>

          <div className="testi-miniStats">
            <div className="testi-miniStat">
              <strong>{items.length.toLocaleString("id-ID")}</strong>
              <span>Total</span>
            </div>
            <div className="testi-miniStat">
              <strong>Real</strong>
              <span>Admin upload</span>
            </div>
            <div className="testi-miniStat">
              <strong>Live</strong>
              <span>Update cepat</span>
            </div>
          </div>

          <div className="testi-miniCta">
            <Link className="btn" to="/produk">
              Produk
            </Link>
            <Link className="btn btn-ghost" to="/status">
              Status
            </Link>
          </div>
        </div>
      </section>

      <section className="section reveal">
        <div className="container">
          <div className="testi-toolbar">
            <div className="testi-searchShell">
              <Search size={16} className="testi-searchIcon" />
              <input
                className="input testi-searchInput"
                placeholder="Cari caption"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {q ? (
                <button type="button" className="testi-clear" onClick={() => setQ("")} aria-label="Hapus">
                  <X size={14} />
                </button>
              ) : null}
            </div>

            <div className="testi-toolbarMeta">
              <div className="testi-count">{loading ? "..." : filtered.length}</div>
              <div className="testi-viewSwitch">
                <button
                  type="button"
                  className={`tab-btn ${view === "masonry" ? "active" : ""}`}
                  onClick={() => setView("masonry")}
                  aria-label="Masonry"
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  type="button"
                  className={`tab-btn ${view === "grid" ? "active" : ""}`}
                  onClick={() => setView("grid")}
                  aria-label="Grid"
                >
                  <Grid2x2 size={15} />
                </button>
              </div>
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
                icon="!"
                title="Testimoni belum bisa dimuat"
                description={error}
                primaryAction={{ label: "Refresh", onClick: () => window.location.reload() }}
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="card pad" style={{ marginTop: 14 }}>
              <EmptyState
                icon="-"
                title="Belum ada hasil"
                description="Coba kata kunci lain."
                primaryAction={{ label: "Reset", onClick: () => setQ("") }}
              />
            </div>
          ) : (
            <>
              <div className={view === "masonry" ? "testi-masonry" : "testi-grid"}>
                {shown.map((item, idx) => (
                  <button
                    key={item.id}
                    className="testi-tile"
                    type="button"
                    onClick={() => setActiveIdx(idx)}
                    aria-label="Buka testimoni"
                  >
                    <div className="testi-imgWrap">
                      <img src={item.image_url} alt={item.caption || "testimoni"} loading="lazy" />
                      <div className="testi-overlay">
                        <span className="testi-overlayPill">Zoom</span>
                        {item.caption ? <span className="testi-captionPill">{item.caption}</span> : null}
                      </div>
                    </div>
                  </button>
                ))}
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

      <AnimatePresence>
        {active && typeof document !== "undefined"
          ? createPortal(
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
                  initial={{ opacity: 0, y: 12, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.985 }}
                  transition={{ duration: 0.22 }}
                >
                  <button
                    className="lightbox-close"
                    type="button"
                    onClick={() => setActiveIdx(-1)}
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>

                  {filtered.length > 1 ? (
                    <>
                      <button
                        className="lightbox-nav prev"
                        type="button"
                        onClick={() => setActiveIdx((i) => (i <= 0 ? filtered.length - 1 : i - 1))}
                        aria-label="Previous"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <button
                        className="lightbox-nav next"
                        type="button"
                        onClick={() => setActiveIdx((i) => (i >= filtered.length - 1 ? 0 : i + 1))}
                        aria-label="Next"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </>
                  ) : null}

                  <div className="lightbox-body">
                    <img className="lightbox-img" src={active.image_url} alt={active.caption || "testimoni"} />
                    {active.caption ? <div className="lightbox-caption">{active.caption}</div> : null}
                  </div>
                </motion.div>
              </motion.div>,
              document.body
            )
          : null}
      </AnimatePresence>
    </div>
  );
}
