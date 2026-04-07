import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Grid2x2,
  LayoutGrid,
  MessageSquareText,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { fetchTestimonials } from "../lib/api";
import EmptyState from "../components/EmptyState";
import { usePageMeta } from "../hooks/usePageMeta";
import { buildStoreInsights } from "../lib/storeInsights";

export default function Testimonials() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [captionMode, setCaptionMode] = useState("all");
  const [view, setView] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return "masonry";
    return window.matchMedia("(max-width: 720px)").matches ? "grid" : "masonry";
  });
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

  const insights = useMemo(() => buildStoreInsights({ testimonials: items }), [items]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let list = items;

    if (captionMode === "captioned") {
      list = list.filter((t) => String(t?.caption || "").trim());
    } else if (captionMode === "uncaptioned") {
      list = list.filter((t) => !String(t?.caption || "").trim());
    }

    if (!s) return list;
    return list.filter((t) => {
      const cap = (t?.caption || "").toLowerCase();
      const url = (t?.image_url || "").toLowerCase();
      return cap.includes(s) || url.includes(s);
    });
  }, [captionMode, items, q]);

  useEffect(() => {
    setLimit(18);
  }, [captionMode, q, view]);

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

  useEffect(() => {
    if (activeIdx >= 0 && activeIdx >= filtered.length) {
      setActiveIdx(-1);
    }
  }, [activeIdx, filtered.length]);

  const shown = useMemo(() => filtered.slice(0, limit), [filtered, limit]);
  const hasMore = shown.length < filtered.length;
  const active = activeIdx >= 0 ? filtered[activeIdx] : null;
  const latestLabel = useMemo(() => {
    if (!insights.latestTestimonial?.created_at) return "Belum ada";
    return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" }).format(
      new Date(insights.latestTestimonial.created_at)
    );
  }, [insights.latestTestimonial]);

  return (
    <div className="page testimonials-page">
      <section className="section reveal testi-shell">
        <div className="container testi-wrap">
          <header className="testi-hero">
            <div className="testi-heroCopy">
              <div className="testi-kicker">Bukti order</div>
              <h1 className="h1 testi-title">Galeri testimoni.</h1>
              <p className="testi-sub">Lihat screenshot order dengan alur yang rapi dan cepat dipindai.</p>
            </div>

            <div className="testi-statePill">
              <CircleHelp size={15} />
              <span>{loading ? "..." : `${filtered.length} item`}</span>
            </div>

            <div className="testi-metrics">
              <article className="testi-metric">
                <span>Total</span>
                <strong>{items.length.toLocaleString("id-ID")}</strong>
                <small>Semua screenshot</small>
              </article>
              <article className="testi-metric">
                <span>Caption</span>
                <strong>{insights.captionedTestimonialsCount.toLocaleString("id-ID")}</strong>
                <small>Berkonteks</small>
              </article>
              <article className="testi-metric">
                <span>Terbaru</span>
                <strong>{latestLabel}</strong>
                <small>Upload terakhir</small>
              </article>
            </div>
          </header>

          <section className="testi-command">
            <div className="testi-commandTop">
              <div className="testi-searchShell">
                <Search size={16} className="testi-searchIcon" />
                <input
                  className="input testi-searchInput"
                  placeholder={insights.captionedTestimonialsCount ? "Cari caption atau nama file" : "Cari nama file screenshot"}
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

            <div className="testi-filterRow" aria-label="Filter testimoni">
              <button
                type="button"
                className={`testi-filterChip${captionMode === "all" ? " active" : ""}`}
                onClick={() => setCaptionMode("all")}
              >
                Semua
              </button>
              <button
                type="button"
                className={`testi-filterChip${captionMode === "captioned" ? " active" : ""}`}
                onClick={() => setCaptionMode("captioned")}
              >
                Ada caption
              </button>
              <button
                type="button"
                className={`testi-filterChip${captionMode === "uncaptioned" ? " active" : ""}`}
                onClick={() => setCaptionMode("uncaptioned")}
              >
                Tanpa caption
              </button>
            </div>
          </section>

          <div className="testi-layout">
            <main className="testi-main">
              <div className="testi-listHead">
                <div className="testi-listKicker">Galeri</div>
                <div className="testi-listCount">{loading ? "..." : `${filtered.length} screenshot`}</div>
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
                    description={
                      captionMode === "all"
                        ? "Coba kata kunci lain atau kosongkan pencarian."
                        : "Ganti filter galeri atau kosongkan pencarian."
                    }
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
                          <img src={item.image_url} alt={item.caption || "testimoni"} loading="lazy" decoding="async" />
                          <div className="testi-overlay">
                            <span className="testi-overlayPill">Zoom</span>
                            <span className={`testi-captionPill${item.caption ? "" : " is-muted"}`}>
                              {item.caption || "Tanpa caption"}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {hasMore ? (
                    <div className="testi-loadmore">
                      <button className="btn btn-ghost" type="button" onClick={() => setLimit((x) => x + 18)}>
                        Muat lagi
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </main>

            <aside className="testi-side">
              <article className="testi-sideCard">
                <div className="testi-sideHead">
                  <Sparkles size={15} />
                  <h3>Akses cepat</h3>
                </div>
                <div className="testi-sideActions">
                  <Link className="btn btn-wide" to="/produk">
                    Produk
                  </Link>
                  <Link className="btn btn-ghost btn-wide" to="/status">
                    Status
                  </Link>
                </div>
              </article>

              <article className="testi-sideCard">
                <div className="testi-sideHead">
                  <MessageSquareText size={15} />
                  <h3>Ringkasan</h3>
                </div>
                <div className="testi-sideList">
                  <div className="testi-sideItem">
                    <span>Ada caption</span>
                    <strong>{insights.captionedTestimonialsCount}</strong>
                  </div>
                  <div className="testi-sideItem">
                    <span>Tanpa caption</span>
                    <strong>{insights.uncaptionedTestimonialsCount}</strong>
                  </div>
                  <div className="testi-sideItem">
                    <span>Terbaru</span>
                    <strong>{latestLabel}</strong>
                  </div>
                </div>
              </article>

              <article className="testi-sideCard">
                <div className="testi-sideHead">
                  <Clock3 size={15} />
                  <h3>Tip cepat</h3>
                </div>
                <p className="testi-sideText">Simpan screenshot dengan caption supaya pencarian order lebih cepat.</p>
              </article>
            </aside>
          </div>
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
