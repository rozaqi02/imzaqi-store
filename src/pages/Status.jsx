import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { formatIDR } from "../lib/format";
import { fetchSettings } from "../lib/api";
import CheckoutSteps from "../components/CheckoutSteps";
import EmptyState from "../components/EmptyState";
import { useToast } from "../context/ToastContext";
import { usePageMeta } from "../hooks/usePageMeta";

function StatusDot({ status }) {
  const s = String(status || "pending");
  const cls =
    s === "done" ? "dot dot-done" :
    s === "processing" ? "dot dot-processing" :
    // kompatibilitas status lama
    s === "paid_reported" ? "dot dot-pending" :
    s === "cancelled" ? "dot dot-cancelled" :
    "dot dot-pending";
  return <span className={cls} aria-hidden="true" />;
}

function prettyStatus(status) {
  const s = String(status || "pending");
  const map = {
    pending: "Pending",
    processing: "Diproses",
    done: "Sukses",
    // kompatibilitas status lama
    paid_reported: "Pending",
    cancelled: "Dibatalkan",
  };
  return map[s] || s;
}

function buildTimeline(status) {
  const s = String(status || "pending");
  // cancelled: show a shorter timeline
  if (s === "cancelled") {
    return {
      steps: [
        { key: "pending", label: "Pending" },
        { key: "cancelled", label: "Dibatalkan" },
      ],
      activeIndex: 1,
    };
  }
  const steps = [
    { key: "pending", label: "Pending" },
    { key: "processing", label: "Diproses" },
    { key: "done", label: "Sukses" },
  ];
  const activeIndex = s === "done" ? 2 : s === "processing" ? 1 : 0;
  return { steps, activeIndex };
}

function statusTone(status) {
  const s = String(status || "pending");
  if (s === "done") return "done";
  if (s === "processing") return "processing";
  if (s === "cancelled") return "cancelled";
  // paid_reported & pending
  return "pending";
}

export default function Status() {
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get("order") || "";

  const toast = useToast();

  usePageMeta({
    title: "Status Order",
    description:
      "Masukkan ID order (contoh: IMZ-ABCD) untuk melihat status & rincian pembelian, lalu hubungi admin jika perlu.",
  });

  const [settings, setSettings] = useState({ whatsapp: { number: "6283136049987" } });
  const waNumber = settings?.whatsapp?.number || "6283136049987";

  const [input, setInput] = useState(param);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [order, setOrder] = useState(null);

  function normalizeOrderCode(inputValue) {
    let code = String(inputValue || "").trim().toUpperCase();
    code = code.replace(/\s+/g, "");

    // If user only pasted 4 chars, assume it's the suffix.
    if (/^[A-Z0-9]{4}$/.test(code)) {
      code = `IMZ-${code}`;
    }

    // If user pasted IMZXXXX without dash.
    if (/^IMZ[A-Z0-9]{4}$/.test(code)) {
      code = `IMZ-${code.slice(3)}`;
    }

    // If it starts with IMZ- but has spaces / extra hyphens.
    code = code.replace(/^IMZ-+/, "IMZ-");
    return code;
  }

  useEffect(() => {
    let alive = true;
    fetchSettings()
      .then((s) => {
        if (!alive) return;
        setSettings({ whatsapp: s.whatsapp || { number: "6283136049987" } });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    // auto search jika ada query param
    if (param) {
      const norm = normalizeOrderCode(param);
      setInput(norm);
      lookup(norm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [param]);

  const waUrl = useMemo(() => {
    const code = order?.order_code || input || "";
    const text = encodeURIComponent(`Halo kak, saya mau tanya status order saya.\n\nID Order: ${code}`);
    return `https://wa.me/${waNumber}?text=${text}`;
  }, [waNumber, order?.order_code, input]);

  async function lookup(codeInput) {
    const code = normalizeOrderCode(codeInput);
    setInput(code);
    if (!code) {
      const t = "Masukkan ID order dulu.";
      setMsg(t);
      setOrder(null);
      toast.error(t);
      return;
    }

    setLoading(true);
    setMsg("");
    setOrder(null);

    try {
      // Pakai RPC agar tetap jalan meskipun RLS orders ketat
      const { data, error } = await supabase.rpc("get_order_public", { p_order_code: code });

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        const t = "Order tidak ditemukan. Cek lagi formatnya (contoh: IMZ-ABCD).";
        setMsg(t);
        toast.error(t);
        return;
      }

      setOrder(row);

      toast.success("Order ditemukan", { title: row.order_code || code, duration: 2600 });

      // sync url param
      setSearchParams({ order: code }, { replace: true });
    } catch (e) {
      const t = "Gagal cek status. Coba lagi beberapa saat.";
      setMsg(t + " Detail: " + (e?.message || e));
      toast.error(t);
    } finally {
      setLoading(false);
    }
  }

  const timeline = useMemo(() => buildTimeline(order?.status), [order?.status]);
  const tone = statusTone(order?.status);
  const discountIDR = useMemo(() => {
    const sub = Number(order?.subtotal_idr || 0);
    const pct = Number(order?.discount_percent || 0);
    return Math.round((sub * pct) / 100);
  }, [order?.subtotal_idr, order?.discount_percent]);

  return (
    <div className="page status3">
      <section className="section reveal status3-hero">
        <div className="container">
          <div className="status2-head">
            <div>
              <h1 className="h1">Status Order</h1>
              <p className="muted">Masukkan ID order untuk melihat progres & rincian pembelian.</p>
            </div>
            <div className="status2-headActions">
              <Link className="btn btn-ghost btn-sm" to="/produk">Produk</Link>
              <Link className="btn btn-ghost btn-sm" to="/checkout">Checkout</Link>
            </div>
          </div>
        </div>

        <div className="container" style={{ marginBottom: 14 }}>
          <CheckoutSteps current="status" />
        </div>

        <div className="container status2-grid">
          {/* LEFT: search */}
          <aside className="status2-card" aria-label="Pencarian order">
            <div className="status2-cardTitle">Cari ID Order</div>
            <div className="status2-cardSub">Contoh format: <b className="mono">IMZ-ABCD</b></div>

            <div className="status2-searchRow">
              <div className="status2-inputWrap">
                <span className="status2-prefix" aria-hidden="true">IMZ-</span>
                <input
                  className="input status2-input"
                  inputMode="text"
                  autoCapitalize="characters"
                  placeholder="ABCD"
                  value={String(input || "").replace(/^IMZ-/, "")}
                  onChange={(e) => setInput(normalizeOrderCode(`IMZ-${e.target.value}`))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") lookup(input);
                  }}
                />
              </div>

              <button className="btn" onClick={() => lookup(input)} disabled={loading}>
                {loading ? "Mencari..." : "Cek"}
              </button>

              <button
                className="btn btn-ghost"
                type="button"
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    const norm = normalizeOrderCode(text);
                    if (!norm) throw new Error("Empty");
                    setInput(norm);
                    toast.success("ID order ditempel", { duration: 2000 });
                  } catch {
                    toast.error("Tidak bisa akses clipboard. Paste manual ya.");
                  }
                }}
              >
                Paste
              </button>
            </div>

            <div className="status2-msg" aria-live="polite">
              {msg ? <div className="hint">{msg}</div> : <div className="hint subtle"> </div>}
            </div>

            <div className="divider" />

            <div className="status2-tips">
              <div className="status2-tip">
                <div className="status2-tipIcon" aria-hidden="true">💡</div>
                <div>
                  <div className="status2-tipTitle">Di mana lihat ID order?</div>
                  <div className="status2-tipText">ID order muncul setelah kamu klik <b>Aku sudah bayar</b> di halaman pembayaran.</div>
                </div>
              </div>
              <div className="status2-tip">
                <div className="status2-tipIcon" aria-hidden="true">🔒</div>
                <div>
                  <div className="status2-tipTitle">Aman</div>
                  <div className="status2-tipText">Halaman ini hanya menampilkan ringkasan order berdasarkan ID-mu.</div>
                </div>
              </div>
            </div>

            <div className="divider" />

            <a className="btn btn-ghost btn-wide" href={waUrl} target="_blank" rel="noreferrer">
              Tanya Admin via WhatsApp
            </a>
          </aside>

          {/* RIGHT: result */}
          <section className="status2-card" aria-label="Hasil status order">
            {!order ? (
              <div className="status2-empty">
                <EmptyState
                  icon={msg ? "⚠️" : "📦"}
                  title={msg ? "Belum ada data order" : "Masukkan ID order"}
                  description={msg || "Setelah ID order ketemu, kamu akan melihat status, rincian item, dan total pembayaran di sini."}
                  primaryAction={{ label: "Buka Checkout", to: "/checkout" }}
                  secondaryAction={{ label: "Pilih Produk", to: "/produk" }}
                />
              </div>
            ) : (
              <>
                <div className={`status2-pill ${tone}`}>
                  <StatusDot status={order.status} />
                  <span className="status2-pillLabel">{prettyStatus(order.status)}</span>
                  <span className="status2-pillSep" aria-hidden="true">•</span>
                  <button
                    className="status2-codeBtn"
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(order.order_code);
                        toast.success("ID order disalin", { duration: 1600 });
                      } catch {
                        toast.error("Gagal menyalin. Salin manual ya.");
                      }
                    }}
                    title="Salin ID order"
                  >
                    <span className="mono">{order.order_code}</span>
                    <span className="status2-copy" aria-hidden="true">⧉</span>
                  </button>
                </div>

                <div className="status2-timeline" aria-label="Tahapan order">
                  {timeline.steps.map((st, i) => {
                    const isDone = i < timeline.activeIndex;
                    const isActive = i === timeline.activeIndex;
                    return (
                      <div
                        key={st.key}
                        className={
                          "status2-step" + (isDone ? " done" : "") + (isActive ? " active" : "")
                        }
                      >
                        <div className="status2-stepDot" aria-hidden="true">
                          {isDone ? "✓" : i + 1}
                        </div>
                        <div className="status2-stepText">
                          <div className="status2-stepTitle">{st.label}</div>
                          <div className="status2-stepSub">
                            {isActive ? "Sedang berjalan" : isDone ? "Selesai" : "Menunggu"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="status2-kvGrid">
                  <div className="status2-kv">
                    <div className="status2-k">Tanggal</div>
                    <div className="status2-v">{new Date(order.created_at).toLocaleString("id-ID")}</div>
                  </div>
                  <div className="status2-kv">
                    <div className="status2-k">Subtotal</div>
                    <div className="status2-v">{formatIDR(order.subtotal_idr || 0)}</div>
                  </div>
                  <div className="status2-kv">
                    <div className="status2-k">Diskon</div>
                    <div className="status2-v">- {formatIDR(discountIDR)}</div>
                  </div>
                  <div className="status2-kv">
                    <div className="status2-k">Total</div>
                    <div className="status2-v total">{formatIDR(order.total_idr || 0)}</div>
                  </div>
                  {order.promo_code ? (
                    <div className="status2-kv span2">
                      <div className="status2-k">Promo</div>
                      <div className="status2-v">
                        <b>{order.promo_code}</b> • {order.discount_percent || 0}%
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="divider" />

                <div className="status2-itemsHead">
                  <div>
                    <div className="status2-itemsTitle">Item yang dibeli</div>
                    <div className="status2-itemsSub">Ringkasan produk & varian.</div>
                  </div>
                </div>

                <div className="status2-items">
                  {(order.items || []).map((it, idx) => (
                    <div key={idx} className="status2-item">
                      <div className="status2-itemLeft">
                        <div className="status2-itemName">{it.product_name}</div>
                        <div className="status2-itemMeta">
                          {it.variant_name} • {it.duration_label} • Qty {it.qty}
                        </div>
                      </div>
                      <div className="status2-itemRight">
                        {formatIDR((it.price_idr || 0) * (it.qty || 0))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="divider" />

                <a className="btn btn-wide" href={waUrl} target="_blank" rel="noreferrer">
                  Hubungi Admin untuk Orderanku
                </a>

                <div className="status2-footerActions">
                  <Link className="btn btn-ghost btn-sm" to="/produk">Belanja lagi</Link>
                  <Link className="btn btn-ghost btn-sm" to="/checkout">Lihat keranjang</Link>
                </div>
              </>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
