import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  BadgePercent,
  CheckCircle2,
  Clock3,
  MessageSquareText,
  Package,
  Search,
  Sparkles,
  WalletCards,
  XCircle,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { formatIDR } from "../lib/format";
import { fetchSettings } from "../lib/api";
import { useToast } from "../context/ToastContext";
import { usePageMeta } from "../hooks/usePageMeta";

function prettyStatus(status) {
  const value = String(status || "pending");
  const map = {
    pending: "Pending",
    processing: "Diproses",
    done: "Sukses",
    paid_reported: "Pending",
    cancelled: "Dibatalkan",
  };
  return map[value] || value;
}

function getStatusMeta(status) {
  const value = String(status || "pending");
  if (value === "done") return { tone: "done", icon: CheckCircle2 };
  if (value === "processing") return { tone: "processing", icon: Sparkles };
  if (value === "cancelled") return { tone: "cancelled", icon: XCircle };
  return { tone: "pending", icon: Clock3 };
}

function getTimeline(status) {
  const value = String(status || "pending");
  if (value === "cancelled") {
    return [
      { key: "pending", label: "Masuk", active: true, done: true },
      { key: "cancelled", label: "Batal", active: true, done: false },
    ];
  }

  return [
    { key: "pending", label: "Masuk", active: true, done: value !== "pending" },
    { key: "processing", label: "Proses", active: value === "processing" || value === "done", done: value === "done" },
    { key: "done", label: "Selesai", active: value === "done", done: value === "done" },
  ];
}

function normalizeOrderCode(value) {
  let code = String(value || "").trim().toUpperCase();
  code = code.replace(/\s+/g, "");
  if (/^[A-Z0-9]{4}$/.test(code)) code = `IMZ-${code}`;
  if (/^IMZ[A-Z0-9]{4}$/.test(code)) code = `IMZ-${code.slice(3)}`;
  return code.replace(/^IMZ-+/, "IMZ-");
}

function toFriendlyStatusError() {
  return "Status belum bisa diambil. Coba lagi beberapa saat.";
}

function TimelineStep({ active, done, label }) {
  const meta = done ? "Selesai" : active ? "Aktif" : "Menunggu";

  return (
    <div className={"status-stepCard" + (active ? " active" : "") + (done ? " done" : "")}>
      <div className="status-stepDot">{done ? <CheckCircle2 size={14} /> : <span />}</div>
      <div className="status-stepCopy">
        <strong>{label}</strong>
        <small>{meta}</small>
      </div>
    </div>
  );
}

export default function Status() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialParam = searchParams.get("order") || "";
  const toast = useToast();

  usePageMeta({
    title: "Status Order",
    description: "Masukkan ID order untuk melihat progres, catatan, dan ringkasan order di satu tempat.",
  });

  const [settings, setSettings] = useState({ whatsapp: { number: "6283136049987" } });
  const [input, setInput] = useState(initialParam);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [order, setOrder] = useState(null);

  const waNumber = settings?.whatsapp?.number || "6283136049987";

  useEffect(() => {
    let active = true;
    fetchSettings()
      .then((result) => {
        if (!active) return;
        setSettings({ whatsapp: result.whatsapp || { number: "6283136049987" } });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!initialParam) return;
    const normalized = normalizeOrderCode(initialParam);
    setInput(normalized);
    lookup(normalized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialParam]);

  const statusMeta = useMemo(() => getStatusMeta(order?.status), [order?.status]);
  const timeline = useMemo(() => getTimeline(order?.status), [order?.status]);

  const discountValue = useMemo(() => {
    const subtotal = Number(order?.subtotal_idr || 0);
    const total = Number(order?.total_idr || 0);
    return Math.max(0, subtotal - total);
  }, [order?.subtotal_idr, order?.total_idr]);

  const itemCount = useMemo(
    () => (order?.items || []).reduce((sum, item) => sum + Number(item?.qty || 0), 0),
    [order?.items]
  );

  const subtotalValue = Number(order?.subtotal_idr || 0);
  const totalValue = Number(order?.total_idr || 0);
  const paidRatio = subtotalValue ? Math.max(18, Math.min(100, (totalValue / subtotalValue) * 100)) : 100;
  const createdDateLabel = useMemo(() => {
    if (!order?.created_at) return "";
    return new Date(order.created_at).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, [order?.created_at]);

  const waUrl = useMemo(() => {
    const code = order?.order_code || input || "";
    const text = encodeURIComponent(`Halo, saya ingin cek order.\n\nID Order: ${code}`);
    return `https://wa.me/${waNumber}?text=${text}`;
  }, [input, order?.order_code, waNumber]);

  async function lookup(rawValue) {
    const code = normalizeOrderCode(rawValue);
    setInput(code);

    if (!code) {
      const text = "Masukkan ID order.";
      setMessage(text);
      setOrder(null);
      toast.error(text);
      return;
    }

    setLoading(true);
    setMessage("");
    setOrder(null);

    try {
      const { data, error } = await supabase.rpc("get_order_public", { p_order_code: code });
      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        const text = "Order tidak ditemukan.";
        setMessage(text);
        toast.error(text);
        return;
      }

      setOrder(row);
      setSearchParams({ order: code }, { replace: true });
      toast.success("Order ditemukan", { title: row.order_code || code, duration: 2200 });
    } catch (error) {
      const text = toFriendlyStatusError();
      console.warn("Gagal mengambil status order:", error);
      setMessage(text);
      toast.error(text);
    } finally {
      setLoading(false);
    }
  }

  async function copyOrderCode() {
    try {
      await navigator.clipboard.writeText(order?.order_code || "");
      toast.success("ID disalin");
    } catch {
      toast.error("Gagal menyalin.");
    }
  }

  async function pasteOrderCode() {
    try {
      const text = await navigator.clipboard.readText();
      const normalized = normalizeOrderCode(text);
      setInput(normalized);
      toast.success("ID ditempel");
    } catch {
      toast.error("Paste manual ya.");
    }
  }

  const StatusIcon = statusMeta.icon;

  return (
    <div className="page status-page">
      <section className="section reveal status-shell">
        <div className="container status-container">
          <div className="status-head">
            <div className="status-headCopy">
              <div className="status-eyebrow">Order tracker</div>
              <h1 className="h1 status-headline">{order ? "Order sudah kebaca." : "Cek order."}</h1>
              <p className="status-lead">{order ? "Ringkas. Jelas. Siap dipantau." : "Masukkan ID order. Hasil langsung tampil."}</p>
            </div>

            {order ? (
              <div className={"status-headState " + statusMeta.tone}>
                <StatusIcon size={18} />
                <span>{prettyStatus(order.status)}</span>
              </div>
            ) : null}
          </div>

          <section className="status-searchCard">
            <div className="status-searchHead">
              <div>
                <div className="status-searchEyebrow">ID order</div>
                <div className="status-searchTitle">{order ? "Cari order lain" : "Masukkan ID"}</div>
              </div>
              <button className="status-searchPaste" type="button" onClick={pasteOrderCode}>
                Paste
              </button>
            </div>

            <div className="status-searchRow">
              <label className="status-searchField">
                <Search size={16} />
                <input
                  className="input status-searchInput"
                  inputMode="text"
                  autoCapitalize="characters"
                  placeholder="Masukkan ID order (contoh: IMZ-ABCD)"
                  value={input}
                  onChange={(e) => setInput(normalizeOrderCode(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") lookup(input);
                  }}
                />
              </label>

              <button className="btn status-searchBtn" type="button" onClick={() => lookup(input)} disabled={loading}>
                {loading ? "Mencari..." : "Cek"}
              </button>
            </div>

            {message ? (
              <div className="status-inlineAlert">{message}</div>
            ) : (
              <div className="status-inlineHint">{order ? "Tap ID untuk menyalin cepat." : "Format cepat: IMZ-ABCD"}</div>
            )}
          </section>

          {!order ? (
            <section className="status-emptyPanel">
              <div className="status-emptyBadge">{message ? "!" : "IMZ"}</div>
              <div className="status-emptyTitle">{message ? "Order belum ketemu." : "Status siap dicek."}</div>
              <div className="status-emptyText">{message || "Tempel ID. Detail order akan muncul di sini."}</div>
              <div className="status-emptyActions">
                <button className="btn btn-ghost" type="button" onClick={pasteOrderCode}>
                  Tempel ID
                </button>
                <a className="btn" href={waUrl} target="_blank" rel="noreferrer">
                  Hubungi admin
                </a>
              </div>
            </section>
          ) : (
            <div className="status-dashboard">
              <section className="status-board">
                <div className="status-overviewGrid">
                  <article className={"status-overviewCard is-status " + statusMeta.tone}>
                    <span>Status</span>
                    <strong>{prettyStatus(order.status)}</strong>
                    <small>Progres order aktif</small>
                  </article>

                  <button className="status-overviewCard status-overviewAction" type="button" onClick={copyOrderCode}>
                    <span>ID order</span>
                    <strong>{order.order_code}</strong>
                    <small>Tap untuk salin</small>
                  </button>

                  <article className="status-overviewCard">
                    <span>Total</span>
                    <strong>{formatIDR(totalValue)}</strong>
                    <small>{itemCount} item</small>
                  </article>

                  <article className="status-overviewCard">
                    <span>Tanggal</span>
                    <strong>{createdDateLabel}</strong>
                    <small>{discountValue > 0 ? `${formatIDR(discountValue)} hemat` : "Tanpa promo"}</small>
                  </article>
                </div>

                <div className="status-boardGrid">
                  <article className="status-card status-progressCard">
                    <div className="status-cardHead">
                      <div>
                        <div className="status-cardEyebrow">Progress</div>
                        <h2 className="status-cardTitle">Tahap order</h2>
                      </div>
                      <div className={"status-cardPill " + statusMeta.tone}>
                        <StatusIcon size={14} />
                        <span>{prettyStatus(order.status)}</span>
                      </div>
                    </div>

                    <div className="status-stepRail">
                      {timeline.map((step, index) => (
                        <React.Fragment key={step.key}>
                          <TimelineStep label={step.label} active={step.active} done={step.done} />
                          {index < timeline.length - 1 ? <div className="status-stepLine" /> : null}
                        </React.Fragment>
                      ))}
                    </div>
                  </article>

                  <article className="status-card status-paymentCard">
                    <div className="status-cardHead">
                      <div>
                        <div className="status-cardEyebrow">Pembayaran</div>
                        <h2 className="status-cardTitle">Ringkasan total</h2>
                      </div>
                      <div className="status-cardIcon">
                        <WalletCards size={16} />
                      </div>
                    </div>

                    <div className="status-paymentRows">
                      <div className="status-paymentRow">
                        <span>Subtotal</span>
                        <b>{formatIDR(subtotalValue)}</b>
                      </div>
                      <div className="status-paymentRow">
                        <span>Potong</span>
                        <b>{formatIDR(discountValue)}</b>
                      </div>
                      <div className="status-paymentRow total">
                        <span>Bayar</span>
                        <b>{formatIDR(totalValue)}</b>
                      </div>
                    </div>

                    <div className="status-paymentBar">
                      <div className="status-paymentTrack">
                        <i style={{ width: `${paidRatio}%` }} />
                      </div>
                      <small>Rasio bayar {Math.round(paidRatio)}%</small>
                    </div>
                  </article>
                </div>

                <article className="status-card status-itemsCard">
                  <div className="status-cardHead">
                    <div>
                      <div className="status-cardEyebrow">Item</div>
                      <h2 className="status-cardTitle">Isi order</h2>
                    </div>
                    <div className="status-cardPill neutral">
                      <Package size={14} />
                      <span>{itemCount} item</span>
                    </div>
                  </div>

                  <div className="status-itemList">
                    {(order.items || []).map((item, index) => (
                      <div key={index} className="status-itemRow">
                        <div className="status-itemRowMain">
                          <div className="status-itemTitle">{item.product_name}</div>
                          <div className="status-itemMeta">
                            <span>{item.variant_name}</span>
                            <span>{item.duration_label}</span>
                            <span>x{item.qty}</span>
                          </div>
                        </div>

                        <b>{formatIDR(Number(item.price_idr || 0) * Number(item.qty || 0))}</b>
                      </div>
                    ))}
                  </div>
                </article>
              </section>

              <aside className="status-sidebar">
                <article className="status-card status-notePanel accent">
                  <div className="status-cardHead">
                    <div>
                      <div className="status-cardEyebrow">Admin</div>
                      <h2 className="status-cardTitle">Catatan admin</h2>
                    </div>
                    <div className="status-cardIcon">
                      <MessageSquareText size={16} />
                    </div>
                  </div>
                  <div className={"status-noteBody" + (order.admin_note ? "" : " empty")}>{order.admin_note || "Belum ada catatan admin."}</div>
                </article>

                <article className="status-card status-notePanel">
                  <div className="status-cardHead">
                    <div>
                      <div className="status-cardEyebrow">Catatanmu</div>
                      <h2 className="status-cardTitle">Info tambahan</h2>
                    </div>
                    <div className="status-cardIcon">
                      <Package size={16} />
                    </div>
                  </div>
                  <div className={"status-noteBody" + (order.notes ? "" : " empty")}>{order.notes || "Tidak ada catatan customer."}</div>
                </article>

                {order.promo_code ? (
                  <article className="status-card status-promoPanel">
                    <div className="status-cardHead">
                      <div>
                        <div className="status-cardEyebrow">Promo</div>
                        <h2 className="status-cardTitle">Kode aktif</h2>
                      </div>
                      <div className="status-cardIcon">
                        <BadgePercent size={16} />
                      </div>
                    </div>
                    <div className="status-promoRow">
                      <b>{order.promo_code}</b>
                      <span>{order.discount_percent || 0}%</span>
                    </div>
                  </article>
                ) : null}

                <article className="status-card status-helpPanel">
                  <div className="status-cardHead">
                    <div>
                      <div className="status-cardEyebrow">Bantuan</div>
                      <h2 className="status-cardTitle">Butuh follow up?</h2>
                    </div>
                    <div className="status-cardIcon">
                      <MessageSquareText size={16} />
                    </div>
                  </div>
                  <div className="status-helpText">Kalau order perlu follow up, kirim ID order ini ke admin.</div>
                  <div className="status-helpActions">
                    <a className="btn btn-wide" href={waUrl} target="_blank" rel="noreferrer">
                      Hubungi admin
                      <ArrowUpRight size={15} />
                    </a>
                    <button className="btn btn-ghost btn-wide" type="button" onClick={copyOrderCode}>
                      Salin ID
                    </button>
                  </div>
                </article>
              </aside>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
