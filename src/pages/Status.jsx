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
    done: "Selesai",
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
      { key: "pending", label: "Order masuk", active: true, done: true },
      { key: "cancelled", label: "Dibatalkan", active: true, done: false },
    ];
  }

  return [
    { key: "pending", label: "Order masuk", active: true, done: value !== "pending" },
    {
      key: "processing",
      label: "Diproses",
      active: value === "processing" || value === "done",
      done: value === "done",
    },
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

function FlowStep({ step }) {
  const stateText = step.done ? "Selesai" : step.active ? "Aktif" : "Menunggu";
  return (
    <div className={`st-flowStep${step.active ? " is-active" : ""}${step.done ? " is-done" : ""}`}>
      <div className="st-flowDot">{step.done ? <CheckCircle2 size={14} /> : <span />}</div>
      <div className="st-flowCopy">
        <strong>{step.label}</strong>
        <small>{stateText}</small>
      </div>
    </div>
  );
}

function InfoCard({ label, value, hint, tone = "" }) {
  return (
    <article className={`st-infoCard${tone ? ` is-${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
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
  const StatusIcon = statusMeta.icon;
  const timeline = useMemo(() => getTimeline(order?.status), [order?.status]);

  const subtotalValue = Number(order?.subtotal_idr || 0);
  const totalValue = Number(order?.total_idr || 0);

  const discountValue = useMemo(() => Math.max(0, subtotalValue - totalValue), [subtotalValue, totalValue]);
  const itemCount = useMemo(
    () => (order?.items || []).reduce((sum, item) => sum + Number(item?.qty || 0), 0),
    [order?.items]
  );

  const paidRatio = subtotalValue
    ? Math.max(16, Math.min(100, Math.round((totalValue / Math.max(subtotalValue, 1)) * 100)))
    : 100;

  const createdDateLabel = useMemo(() => {
    if (!order?.created_at) return "-";
    return new Date(order.created_at).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, [order?.created_at]);

  const waUrl = useMemo(() => {
    const code = order?.order_code || input || "";
    const text = encodeURIComponent(`Halo admin, saya ingin cek order.\n\nID Order: ${code}`);
    return `https://wa.me/${waNumber}?text=${text}`;
  }, [input, order?.order_code, waNumber]);

  async function lookup(rawValue) {
    const code = normalizeOrderCode(rawValue);
    setInput(code);

    if (!code) {
      const text = "Masukkan ID order dulu.";
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
      toast.error("Gagal menyalin ID.");
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

  return (
    <div className="page status-page">
      <section className="section reveal status-shell">
        <div className="container st-wrap">
          <header className="st-hero">
            <div className="st-heroCopy">
              <div className="st-kicker">Order tracker</div>
              <h1 className="h1 st-title">{order ? "Order kebaca." : "Cek status order."}</h1>
              <p className="st-sub">{order ? "Progress rapi dalam satu layar." : "Masukkan ID order untuk lihat progres terbaru."}</p>
            </div>

            {order ? (
              <div className={`st-statePill is-${statusMeta.tone}`}>
                <StatusIcon size={16} />
                <span>{prettyStatus(order.status)}</span>
              </div>
            ) : null}
          </header>

          <section className="st-search">
            <div className="st-searchHead">
              <div>
                <div className="st-kicker">ID order</div>
                <h2 className="st-searchTitle">{order ? "Cari order lain" : "Masukkan ID"}</h2>
              </div>
              <button className="st-pasteBtn" type="button" onClick={pasteOrderCode}>
                Paste
              </button>
            </div>

            <div className="st-searchRow">
              <label className="st-inputWrap">
                <Search size={16} />
                <input
                  className="input st-input"
                  inputMode="text"
                  autoCapitalize="characters"
                  placeholder="Contoh: IMZ-ABCD"
                  value={input}
                  onChange={(e) => setInput(normalizeOrderCode(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") lookup(input);
                  }}
                />
              </label>

              <button className="btn st-checkBtn" type="button" onClick={() => lookup(input)} disabled={loading}>
                {loading ? "Mencari..." : "Cek status"}
              </button>
            </div>

            <div className={`st-searchHint${message ? " is-error" : ""}`}>
              {message || (order ? "Klik kartu ID order untuk salin cepat." : "Format singkat juga bisa: ABCD")}
            </div>
          </section>

          {!order ? (
            <section className="st-empty">
              <div className="st-emptyBadge">IMZ</div>
              <h2 className="st-emptyTitle">Status siap dipantau</h2>
              <p className="st-emptyText">Tempel ID order, lalu semua ringkasan akan muncul otomatis di sini.</p>
              <div className="st-emptyActions">
                <button className="btn btn-ghost" type="button" onClick={pasteOrderCode}>
                  Tempel ID
                </button>
                <a className="btn" href={waUrl} target="_blank" rel="noreferrer">
                  Hubungi admin
                </a>
              </div>
            </section>
          ) : (
            <div className="st-layout">
              <main className="st-main">
                <section className="st-metrics">
                  <InfoCard label="Status" value={prettyStatus(order.status)} hint="Status aktif" tone={statusMeta.tone} />

                  <button className="st-infoCard st-infoAction" type="button" onClick={copyOrderCode}>
                    <span>ID order</span>
                    <strong>{order.order_code}</strong>
                    <small>Tap untuk salin</small>
                  </button>

                  <InfoCard label="Total bayar" value={formatIDR(totalValue)} hint={`${itemCount} item`} />
                  <InfoCard
                    label="Tanggal"
                    value={createdDateLabel}
                    hint={discountValue > 0 ? `${formatIDR(discountValue)} hemat` : "Tanpa promo"}
                  />
                </section>

                <article className="st-card st-flow">
                  <div className="st-cardHead">
                    <div>
                      <div className="st-kicker">Progress</div>
                      <h2 className="st-cardTitle">Tahap order</h2>
                    </div>
                    <div className={`st-statePill is-${statusMeta.tone}`}>
                      <StatusIcon size={14} />
                      <span>{prettyStatus(order.status)}</span>
                    </div>
                  </div>

                  <div className="st-flowRail">
                    {timeline.map((step, index) => (
                      <React.Fragment key={step.key}>
                        <FlowStep step={step} />
                        {index < timeline.length - 1 ? <div className="st-flowLine" /> : null}
                      </React.Fragment>
                    ))}
                  </div>
                </article>

                <article className="st-card st-items">
                  <div className="st-cardHead">
                    <div>
                      <div className="st-kicker">Item order</div>
                      <h2 className="st-cardTitle">Daftar paket</h2>
                    </div>
                    <div className="st-cardIcon">
                      <Package size={16} />
                    </div>
                  </div>

                  <div className="st-itemList">
                    {(order.items || []).map((item, index) => (
                      <div key={index} className="st-itemRow">
                        <div className="st-itemMain">
                          <div className="st-itemName">{item.product_name}</div>
                          <div className="st-itemMeta">
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
              </main>

              <aside className="st-aside">
                <article className="st-card st-payCard">
                  <div className="st-cardHead">
                    <div>
                      <div className="st-kicker">Pembayaran</div>
                      <h2 className="st-cardTitle">Ringkasan total</h2>
                    </div>
                    <div className="st-cardIcon">
                      <WalletCards size={16} />
                    </div>
                  </div>

                  <div className="st-payRows">
                    <div className="st-payRow">
                      <span>Subtotal</span>
                      <b>{formatIDR(subtotalValue)}</b>
                    </div>
                    <div className="st-payRow">
                      <span>Potong</span>
                      <b>{formatIDR(discountValue)}</b>
                    </div>
                    <div className="st-payRow is-total">
                      <span>Total</span>
                      <b>{formatIDR(totalValue)}</b>
                    </div>
                  </div>

                  <div className="st-payProgress">
                    <div className="st-payTrack">
                      <i style={{ width: `${paidRatio}%` }} />
                    </div>
                    <small>Rasio bayar {paidRatio}%</small>
                  </div>
                </article>

                <article className="st-card st-noteCard is-accent">
                  <div className="st-cardHead">
                    <div>
                      <div className="st-kicker">Admin</div>
                      <h2 className="st-cardTitle">Catatan admin</h2>
                    </div>
                    <div className="st-cardIcon">
                      <MessageSquareText size={16} />
                    </div>
                  </div>
                  <div className={`st-noteBody${order.admin_note ? "" : " is-empty"}`}>{order.admin_note || "Belum ada catatan admin."}</div>
                </article>

                <article className="st-card st-noteCard">
                  <div className="st-cardHead">
                    <div>
                      <div className="st-kicker">Catatan buyer</div>
                      <h2 className="st-cardTitle">Info tambahan</h2>
                    </div>
                    <div className="st-cardIcon">
                      <MessageSquareText size={16} />
                    </div>
                  </div>
                  <div className={`st-noteBody${order.notes ? "" : " is-empty"}`}>{order.notes || "Tidak ada catatan customer."}</div>
                </article>

                {order.promo_code ? (
                  <article className="st-card st-promoCard">
                    <div className="st-cardHead">
                      <div>
                        <div className="st-kicker">Promo</div>
                        <h2 className="st-cardTitle">Kode aktif</h2>
                      </div>
                      <div className="st-cardIcon">
                        <BadgePercent size={16} />
                      </div>
                    </div>
                    <div className="st-promoRow">
                      <b>{order.promo_code}</b>
                      <span>{order.discount_percent || 0}%</span>
                    </div>
                  </article>
                ) : null}

                <article className="st-card st-helpCard">
                  <div className="st-cardHead">
                    <div>
                      <div className="st-kicker">Bantuan</div>
                      <h2 className="st-cardTitle">Perlu follow up?</h2>
                    </div>
                    <div className="st-cardIcon">
                      <Sparkles size={16} />
                    </div>
                  </div>

                  <p className="st-helpText">Jika ada kendala, kirim ID order ini ke admin agar diproses lebih cepat.</p>

                  <div className="st-helpActions">
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
