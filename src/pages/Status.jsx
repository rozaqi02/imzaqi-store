import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BadgePercent,
  CheckCircle2,
  Clock3,
  History,
  Mail,
  MessageSquareText,
  Package,
  Search,
  ShieldCheck,
  Sparkles,
  WalletCards,
  XCircle,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { formatIDR } from "../lib/format";
import { fetchSettings } from "../lib/api";
import { getOrderHistory, updateOrderHistoryStatus } from "../lib/orderHistory";
import { useToast } from "../context/ToastContext";
import { usePageMeta } from "../hooks/usePageMeta";
import "../css/pages/OrderHistory.css";

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function statusTone(status) {
  const map = {
    pending: "pending",
    paid_reported: "pending",
    processing: "processing",
    done: "done",
    cancelled: "cancelled",
  };
  return map[String(status || "pending")] || "pending";
}

function formatDate(isoString) {
  if (!isoString) return "-";
  try {
    return new Date(isoString).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "-";
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

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

// ─── Tab: Cek Status ─────────────────────────────────────────────────────────

function TabCekStatus({ settings }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialParam = searchParams.get("order") || "";
  const toast = useToast();

  const [input, setInput] = useState(initialParam);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [order, setOrder] = useState(null);

  const waNumber = settings?.whatsapp?.number || "6283136049987";

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
      setSearchParams({ tab: "cek", order: code }, { replace: true });
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
    <>
      {order ? (
        <div className={`st-statePill is-${statusMeta.tone}`} style={{ marginBottom: 4 }}>
          <StatusIcon size={16} />
          <span>{prettyStatus(order.status)}</span>
        </div>
      ) : null}

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
            {loading ? (
              <>
                <span className="st-checkSpinner" aria-hidden="true" />
                Mencari...
              </>
            ) : "Cek status"}
          </button>
        </div>

        <div className={`st-searchHint${message ? " is-error" : ""}`}>
          {message || (order ? "Klik kartu ID order untuk salin cepat." : "Format singkat juga bisa: ABCD")}
        </div>
      </section>

      {!order ? (
        <section className="st-empty">
          <div className="st-emptyBadge">IMZ</div>
          <h2 className="st-emptyTitle">Status Ordermu siap dipantau</h2>
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
          {order.admin_note ? (
            <article className="st-card st-noteCard st-noteTopAccent is-accent">
              <div className="st-cardHead">
                <div>
                  <div className="st-kicker">Catatan admin</div>
                  <h2 className="st-cardTitle">Penting untuk dibaca</h2>
                </div>
                <div className="st-cardIcon">
                  <MessageSquareText size={16} />
                </div>
              </div>
              <div className="st-noteBody">{order.admin_note}</div>
            </article>
          ) : null}

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
                {(order.items || []).map((item, index) => {
                  const iconUrl = String(item?.product_icon_url || "").trim();
                  const guarantee = String(item?.guarantee_text || "").trim();
                  const variantName = String(item?.variant_name || "").trim();
                  const durationLabel = String(item?.duration_label || "").trim();
                  const description = String(item?.description || "").trim();
                  const requiresEmail = !!item?.requires_buyer_email;
                  const itemTotal = Number(item.price_idr || 0) * Number(item.qty || 0);
                  return (
                    <div key={index} className="st-itemRow st-itemRowDetailed">
                      <div className="st-itemHead">
                        <div className="st-itemIcon" aria-hidden="true">
                          {iconUrl ? (
                            <img src={iconUrl} alt="" loading="lazy" decoding="async" />
                          ) : (
                            <span>{String(item.product_name || "P").slice(0, 1).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="st-itemMain">
                          <div className="st-itemName">{item.product_name}</div>
                          {variantName ? <div className="st-itemVariant">{variantName}</div> : null}
                        </div>
                        <div className="st-itemPrice">
                          <span className="st-itemPriceQty">×{item.qty}</span>
                          <b>{formatIDR(itemTotal)}</b>
                          <small>{formatIDR(Number(item.price_idr || 0))} / pcs</small>
                        </div>
                      </div>

                      <div className="st-itemFacts">
                        {durationLabel ? (
                          <span className="st-itemFact">
                            <Clock3 size={12} />
                            <span>{durationLabel}</span>
                          </span>
                        ) : null}
                        {guarantee ? (
                          <span className="st-itemFact st-itemFact--guarantee">
                            <ShieldCheck size={12} />
                            <span>{guarantee}</span>
                          </span>
                        ) : null}
                        {requiresEmail ? (
                          <span className="st-itemFact st-itemFact--email">
                            <Mail size={12} />
                            <span>Butuh email aktivasi</span>
                          </span>
                        ) : null}
                      </div>

                      {description ? <div className="st-itemDesc">{description}</div> : null}
                    </div>
                  );
                })}
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
              <div className={`st-noteBody${order.notes ? "" : " is-empty"}`}>
                {order.notes || "Tidak ada catatan customer."}
              </div>
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
    </>
  );
}

// ─── Tab: Riwayat ────────────────────────────────────────────────────────────

function TabRiwayat() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchErrors, setFetchErrors] = useState({});

  useEffect(() => {
    const history = getOrderHistory();
    setEntries(history);

    if (history.length === 0) {
      setLoading(false);
      return;
    }

    let active = true;

    async function syncStatuses() {
      const results = await Promise.allSettled(
        history.map(async (entry) => {
          const { data, error } = await supabase.rpc("get_order_public", {
            p_order_code: entry.order_code,
          });
          if (error) throw error;
          const row = Array.isArray(data) ? data[0] : data;
          if (!row) throw new Error("not found");
          return { order_code: entry.order_code, status: row.status };
        })
      );

      if (!active) return;

      const errors = {};
      results.forEach((result, index) => {
        const entry = history[index];
        if (result.status === "fulfilled") {
          updateOrderHistoryStatus(entry.order_code, result.value.status);
        } else {
          errors[entry.order_code] = true;
        }
      });

      setFetchErrors(errors);
      setEntries(getOrderHistory());
      setLoading(false);
    }

    syncStatuses();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="oh-loading" role="status" aria-label="Memuat riwayat order">
        <div className="oh-loadingDot" />
        <div className="oh-loadingDot" />
        <div className="oh-loadingDot" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="oh-empty">
        <div className="oh-emptyIcon">
          <Package size={32} />
        </div>
        <h2 className="oh-emptyTitle">Belum ada riwayat order dari browser ini</h2>
        <p className="oh-emptyText">
          Order yang kamu buat akan otomatis tersimpan di sini untuk kemudahan pengecekan status.
        </p>
        <Link className="btn" to="/produk">
          Lihat Produk
        </Link>
      </div>
    );
  }

  return (
    <div className="oh-list">
      {entries.map((entry) => {
        const hasFetchError = fetchErrors[entry.order_code];
        const tone = statusTone(entry.status);

        return (
          <article key={entry.order_code} className="oh-card">
            <div className="oh-cardTop">
              <div className="oh-cardLeft">
                <div className="oh-orderCode">{entry.order_code}</div>
                <div className="oh-orderMeta">
                  <span className="oh-orderDate">
                    <Clock3 size={12} />
                    {formatDate(entry.created_at)}
                  </span>
                  <span className="oh-orderTotal">{formatIDR(entry.total_idr)}</span>
                </div>
              </div>

              <div className="oh-cardRight">
                <span className={`oh-statusPill is-${tone}`}>
                  {prettyStatus(entry.status)}
                </span>
              </div>
            </div>

            {hasFetchError ? (
              <div className="oh-fetchError">
                <AlertCircle size={13} />
                <span>Gagal memperbarui — menampilkan status tersimpan</span>
              </div>
            ) : null}

            <div className="oh-cardActions">
              <Link
                className="btn btn-sm oh-cekBtn"
                to={`/status?tab=cek&order=${encodeURIComponent(entry.order_code)}`}
              >
                Cek Status
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Status() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = tabParam === "riwayat" ? "riwayat" : "cek";

  const [settings, setSettings] = useState({ whatsapp: { number: "6283136049987" } });

  usePageMeta({
    title: activeTab === "riwayat" ? "Riwayat Order" : "Status Order",
    description:
      activeTab === "riwayat"
        ? "Lihat semua riwayat order yang pernah dibuat dari browser ini."
        : "Masukkan ID order untuk melihat progres, catatan, dan ringkasan order di satu tempat.",
  });

  useEffect(() => {
    let active = true;
    fetchSettings()
      .then((result) => {
        if (!active) return;
        setSettings({ whatsapp: result.whatsapp || { number: "6283136049987" } });
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  function switchTab(tab) {
    setSearchParams(tab === "cek" ? {} : { tab }, { replace: true });
  }

  return (
    <div className="page status-page">
      <section className="section reveal status-shell">
        <div className="container st-wrap">
          <header className="st-hero">
            <div className="st-heroCopy">
              <div className="st-kicker">Order tracker</div>
              <h1 className="h1 st-title">
                {activeTab === "riwayat" ? "Riwayat Order." : "Cek status order."}
              </h1>
              <p className="st-sub">
                {activeTab === "riwayat"
                  ? "Semua order dari browser ini tersimpan di sini."
                  : "Masukkan ID order untuk lihat progres terbaru."}
              </p>
            </div>
          </header>

          {/* Tab switcher */}
          <div className="st-tabs" role="tablist" aria-label="Pilih tampilan">
            <button
              role="tab"
              type="button"
              aria-selected={activeTab === "cek"}
              className={`st-tab${activeTab === "cek" ? " is-active" : ""}`}
              onClick={() => switchTab("cek")}
            >
              <Activity size={15} />
              Cek Status
            </button>
            <button
              role="tab"
              type="button"
              aria-selected={activeTab === "riwayat"}
              className={`st-tab${activeTab === "riwayat" ? " is-active" : ""}`}
              onClick={() => switchTab("riwayat")}
            >
              <History size={15} />
              Riwayat
            </button>
          </div>

          {activeTab === "cek" ? (
            <TabCekStatus settings={settings} />
          ) : (
            <TabRiwayat />
          )}
        </div>
      </section>
    </div>
  );
}
