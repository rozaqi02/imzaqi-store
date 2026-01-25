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

  return (
    <div className="page">
      <section className="section reveal">
        <div className="container section-head">
          <div>
            <h1 className="h1">Status Order</h1>
            <p className="muted">Masukkan ID order untuk melihat status & rincian pembelian.</p>
          </div>
        </div>

        <div className="container" style={{ marginBottom: 14 }}>
          <CheckoutSteps current="status" />
        </div>

        <div className="container status-grid">
          <div className="card pad">
            <label className="label">ID Order</label>
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <input
                className="input"
                placeholder="contoh: IMZ-ABCD"
                value={input}
                onChange={(e) => setInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") lookup(input);
                }}
              />
              <button className="btn" onClick={() => lookup(input)} disabled={loading}>
                {loading ? "Mencari..." : "Cari"}
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

            {msg ? <div className="hint" style={{ marginTop: 10 }}>{msg}</div> : null}

            <div className="divider" />

            <div className="hint subtle">
              Tips: ID order muncul setelah kamu klik <b>Aku sudah bayar</b> di halaman pembayaran.
            </div>
          </div>

          <div className="card pad">
            {!order ? (
              <EmptyState
                icon={msg ? "⚠️" : "📦"}
                title={msg ? "Belum ada data order" : "Cek status order"}
                description={msg || "Masukkan ID order di sebelah kiri. Setelah ketemu, kamu bisa lihat status + rincian pembelian di sini."}
                primaryAction={{ label: "Buka Checkout", to: "/checkout" }}
                secondaryAction={{ label: "Pilih Produk", to: "/produk" }}
              />
            ) : (
              <>
                <div className="status-badge">
                  <StatusDot status={order.status} />
                  <b>{prettyStatus(order.status)}</b>
                </div>

                <div className="status-flow" aria-label="Tahapan order">
                  {(() => {
                    const flow = ["pending", "processing", "done"];
                    const raw = String(order.status || "pending");
                    const idx = raw === "done" ? 2 : raw === "processing" ? 1 : 0;
                    return flow.map((k, i) => (
                      <div
                        key={k}
                        className={
                          i < idx
                            ? "flow-step done"
                            : i === idx
                              ? "flow-step active"
                              : "flow-step"
                        }
                      >
                        <span className="flow-dot" aria-hidden="true">{i < idx ? "✓" : i + 1}</span>
                        <span className="flow-label">{prettyStatus(k)}</span>
                      </div>
                    ));
                  })()}
                </div>

                <div className="status-meta">
                  <div className="kv">
                    <span className="muted">ID Order</span>
                    <b className="mono">{order.order_code}</b>
                  </div>
                  <div className="kv">
                    <span className="muted">Tanggal</span>
                    <b>{new Date(order.created_at).toLocaleString("id-ID")}</b>
                  </div>
                  <div className="kv">
                    <span className="muted">Subtotal</span>
                    <b>{formatIDR(order.subtotal_idr || 0)}</b>
                  </div>
                  <div className="kv">
                    <span className="muted">Diskon</span>
                    <b>- {formatIDR(Math.round(((order.subtotal_idr || 0) * (order.discount_percent || 0)) / 100))}</b>
                  </div>
                  <div className="kv">
                    <span className="muted">Total</span>
                    <b>{formatIDR(order.total_idr || 0)}</b>
                  </div>
                  {order.promo_code ? (
                    <div className="kv">
                      <span className="muted">Promo</span>
                      <b>{order.promo_code} ({order.discount_percent || 0}%)</b>
                    </div>
                  ) : null}
                </div>

                <div className="divider" />

                <div className="status-items">
                  {(order.items || []).map((it, idx) => (
                    <div key={idx} className="status-item">
                      <div>
                        <div className="status-title">{it.product_name}</div>
                        <div className="status-sub">
                          {it.variant_name} • {it.duration_label} • Qty {it.qty}
                        </div>
                      </div>
                      <div className="order-total">{formatIDR((it.price_idr || 0) * (it.qty || 0))}</div>
                    </div>
                  ))}
                </div>

                <div className="divider" />

                <a className="btn btn-wide" href={waUrl} target="_blank" rel="noreferrer">
                  Hubungi Admin Untuk Orderanku
                </a>

                <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                  <Link className="btn btn-ghost btn-sm" to="/produk">
                    Belanja lagi
                  </Link>
                  <Link className="btn btn-ghost btn-sm" to="/checkout">
                    Lihat keranjang
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
