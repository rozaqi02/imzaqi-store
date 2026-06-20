import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BadgePercent,
  Calendar,
  CheckCircle2,
  Clock3,
  Copy,
  History,
  Mail,
  MessageSquareText,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  WalletCards,
  XCircle,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { formatIDR } from "../lib/format";
import { fetchSettings } from "../lib/api";
import {
  getOrderHistory,
  updateOrderHistoryStatus,
  removeOrderFromHistory,
  clearOrderHistory,
} from "../lib/orderHistory";
import { useToast } from "../context/ToastContext";
import { usePageMeta } from "../hooks/usePageMeta";
import { copyToClipboard } from "../utils/clipboard";
import "../css/pages/OrderHistory.css";
import "../css/pages/Status.css";

// ─── Constants ───────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000;
const TERMINAL_STATUSES = new Set(["done", "cancelled"]);

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

// Dipakai saat onChange — hanya uppercase + strip spasi, biarkan user hapus dengan bebas
function sanitizeOrderInput(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

// Dipakai saat lookup/submit — normalisasi penuh ke format IMZ-XXXX atau IMZ-XXXXXXXX
function normalizeOrderCode(value) {
  // Strip semua karakter non-alphanumeric kecuali dash sementara
  const cleaned = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!cleaned) return "";
  // Cek apakah sudah ada prefix IMZ
  const withoutPrefix = cleaned.startsWith("IMZ") ? cleaned.slice(3) : cleaned;
  // Gunakan 8 karakter jika panjangnya tepat 8, jika tidak ambil 4 karakter terakhir
  const code = withoutPrefix.length === 8 ? withoutPrefix : withoutPrefix.slice(-4);
  if (code.length === 4 || code.length === 8) return `IMZ-${code}`;
  // Kode belum lengkap, kembalikan mentah untuk ditampilkan error
  return cleaned;
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

function formatRelativeTime(date) {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return "baru saja";
  if (seconds < 60) return `${seconds} dtk lalu`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} mnt lalu`;
  return `${Math.round(minutes / 60)} jam lalu`;
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

function InfoCard({ label, value, hint, tone = "", icon: Icon }) {
  return (
    <article className={`st-infoCard${tone ? ` is-${tone}` : ""}`}>
      <div className="st-infoCard-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
        <span>{label}</span>
        {Icon && <Icon size={14} style={{ opacity: 0.8, color: "var(--st-muted)" }} />}
      </div>
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
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const waNumber = settings?.whatsapp?.number || "6283136049987";
  const pollTimerRef = useRef(null);

  const lookup = useCallback(async (rawValue) => {
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
  }, []);

  // Silent refresh — update status di background tanpa reset UI
  const silentRefresh = useCallback(async (orderCode) => {
    if (!orderCode) return;
    setRefreshing(true);
    try {
      const { data, error } = await supabase.rpc("get_order_public", { p_order_code: orderCode });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return;
      setOrder(row);
      setLastUpdated(new Date());
    } catch {
      // silent — tidak tampil error untuk background refresh
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!initialParam) return;
    const normalized = normalizeOrderCode(initialParam);
    setInput(normalized);
    lookup(normalized);
  }, [initialParam, lookup]);

  // Auto-refresh polling — berhenti kalau status sudah terminal
  useEffect(() => {
    if (!order || TERMINAL_STATUSES.has(order.status)) return;
    pollTimerRef.current = setInterval(() => {
      silentRefresh(order.order_code);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(pollTimerRef.current);
  }, [order, silentRefresh]);

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
  // Kalau subtotal 0, bar tetap kosong agar tidak menyesatkan
  const paidRatioRaw = subtotalValue > 0
    ? Math.round((totalValue / subtotalValue) * 100)
    : 0;
  const paidRatioBar = Math.max(4, paidRatioRaw);
  const paidRatio = subtotalValue > 0 ? Math.min(100, paidRatioRaw) : 0;

  const statusHint = useMemo(() => {
    const val = order?.status;
    if (val === "pending") return "Menunggu pembayaran QRIS";
    if (val === "paid_reported") return "Menunggu konfirmasi admin";
    if (val === "processing") return "Sedang diproses oleh admin";
    if (val === "done") return "Sukses, siap digunakan";
    if (val === "cancelled") return "Pesanan dibatalkan";
    return "Status aktif";
  }, [order?.status]);

  const statusIcon = useMemo(() => {
    const val = order?.status;
    if (val === "done") return CheckCircle2;
    if (val === "processing") return Sparkles;
    if (val === "cancelled") return XCircle;
    return Clock3;
  }, [order?.status]);

  const totalHint = useMemo(() => {
    return `${itemCount} item \u2022 Metode QRIS`;
  }, [itemCount]);

  const dateHint = useMemo(() => {
    if (discountValue > 0) {
      return `Hemat ${formatIDR(discountValue)} (Promo)`;
    }
    return "Metode QRIS Instant";
  }, [discountValue]);

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

  async function copyOrderCode() {
    try {
      await copyToClipboard(order?.order_code || "");
      toast.success("ID disalin");
    } catch {
      toast.error("Gagal menyalin ID.");
    }
  }

  async function pasteOrderCode() {
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        throw new Error();
      }
      const text = await navigator.clipboard.readText();
      const normalized = normalizeOrderCode(text);
      setInput(normalized);
      toast.success("ID ditempel");
    } catch {
      toast.error("Paste manual ya.");
    }
  }

  const isTerminal = order ? TERMINAL_STATUSES.has(order.status) : false;
  const lastUpdatedLabel = lastUpdated ? formatRelativeTime(lastUpdated) : null;

  return (
    <>
      {order ? (
        <div className="st-statePillRow" aria-live="polite" aria-atomic="true">
          <div className={`st-statePill is-${statusMeta.tone}`}>
            <StatusIcon size={16} />
            <span>{prettyStatus(order.status)}</span>
          </div>
          <div className="st-lastUpdated">
            {refreshing ? <span className="st-refreshingDot" aria-hidden="true" /> : null}
            {lastUpdatedLabel ? <span>Diperbarui {lastUpdatedLabel}</span> : null}
            {!isTerminal ? (
              <button
                type="button"
                className="st-refreshBtn"
                onClick={() => silentRefresh(order.order_code)}
                disabled={refreshing}
                aria-label="Perbarui status"
                title="Perbarui status"
              >
                <RefreshCw size={13} />
              </button>
            ) : null}
          </div>
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
              placeholder="Contoh: IMZ-ABCD atau IMZ-ABCDEFGH"
              value={input}
              onChange={(e) => setInput(sanitizeOrderInput(e.target.value))}
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
                <button
                  type="button"
                  className="btn btn-ghost btn-sm st-copyNoteBtn"
                  onClick={async () => {
                    try {
                      await copyToClipboard(order.admin_note);
                      toast.success("Catatan disalin");
                    } catch {
                      toast.error("Gagal menyalin catatan");
                    }
                  }}
                  title="Salin catatan admin"
                >
                  <Copy size={12} />
                  <span>Salin</span>
                </button>
              </div>
              <div className="st-noteBody">{order.admin_note}</div>
            </article>
          ) : null}

          <main className="st-main">
            <section className="st-metrics">
              <InfoCard
                label="Status"
                value={prettyStatus(order.status)}
                hint={statusHint}
                tone={statusMeta.tone}
                icon={statusIcon}
              />

              <button className="st-infoCard st-infoAction" type="button" onClick={copyOrderCode}>
                <div className="st-infoCard-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                  <span>ID order</span>
                  <Copy size={14} style={{ opacity: 0.8, color: "var(--st-muted)" }} />
                </div>
                <strong>{order.order_code}</strong>
                <small>Tap untuk salin ID</small>
              </button>

              <InfoCard
                label="Total bayar"
                value={formatIDR(totalValue)}
                hint={totalHint}
                icon={WalletCards}
              />
              <InfoCard
                label="Tanggal"
                value={createdDateLabel}
                hint={dateHint}
                icon={Calendar}
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
                <div
                  className="st-payTrack"
                  role="progressbar"
                  aria-valuenow={paidRatio}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Rasio bayar ${paidRatio}%`}
                >
                  <i style={{ width: `${paidRatioBar}%` }} />
                </div>
                <small>
                  {subtotalValue > 0 ? `Rasio bayar ${paidRatio}%` : "Data harga belum tersedia"}
                </small>
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
  const [syncing, setSyncing] = useState(false);
  const [fetchErrors, setFetchErrors] = useState({});
  const [confirmClear, setConfirmClear] = useState(false);
  const toast = useToast();

  const doSync = useCallback(async (silent = false) => {
    const history = getOrderHistory();
    setEntries(history);
    if (history.length === 0) {
      setLoading(false);
      setSyncing(false);
      return;
    }
    if (!silent) setSyncing(true);

    const errors = {};
    try {
      const codes = history.map((h) => h.order_code);
      const { data, error } = await supabase.rpc("get_orders_public_bulk", {
        p_order_codes: codes,
      });
      if (error) throw error;

      const statusMap = {};
      (data || []).forEach((row) => {
        statusMap[row.order_code] = row.status;
      });

      history.forEach((entry) => {
        const status = statusMap[entry.order_code];
        if (status) {
          updateOrderHistoryStatus(entry.order_code, status);
        } else {
          errors[entry.order_code] = true;
        }
      });
    } catch (err) {
      console.error("Gagal sinkronisasi riwayat:", err);
      history.forEach((entry) => {
        errors[entry.order_code] = true;
      });
    }

    setFetchErrors(errors);
    setEntries(getOrderHistory());
    setLoading(false);
    setSyncing(false);
  }, []);

  useEffect(() => {
    let active = true;
    doSync(true).then(() => { if (!active) return; });
    return () => { active = false; };
  }, [doSync]);

  function handleRemove(order_code) {
    removeOrderFromHistory(order_code);
    setEntries(getOrderHistory());
    toast.success("Entri dihapus");
  }

  function handleClearAll() {
    clearOrderHistory();
    setEntries([]);
    setConfirmClear(false);
    toast.success("Riwayat dibersihkan");
  }

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
      {/* Toolbar: refresh + clear all */}
      <div className="oh-listToolbar">
        <button
          type="button"
          className="btn btn-sm btn-ghost oh-refreshAllBtn"
          onClick={() => doSync()}
          disabled={syncing}
          aria-label="Perbarui semua status"
        >
          <RefreshCw size={13} className={syncing ? "oh-spinIcon" : ""} />
          {syncing ? "Memperbarui..." : "Perbarui"}
        </button>

        {confirmClear ? (
          <div className="oh-confirmClear">
            <span>Hapus semua?</span>
            <button type="button" className="btn btn-sm" onClick={handleClearAll}>Ya, hapus</button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirmClear(false)}>Batal</button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-sm btn-ghost oh-clearAllBtn"
            onClick={() => setConfirmClear(true)}
            aria-label="Hapus semua riwayat"
          >
            <Trash2 size={13} />
            Hapus semua
          </button>
        )}
      </div>

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
                <button
                  type="button"
                  className="oh-removeBtn"
                  onClick={() => handleRemove(entry.order_code)}
                  aria-label={`Hapus ${entry.order_code} dari riwayat`}
                  title="Hapus dari riwayat"
                >
                  <Trash2 size={13} />
                </button>
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
        ? "Semua order dari browser ini tersimpan di sini."
        : "Masukin ID order, langsung keliatan progress-nya.",
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
              <div className="st-kicker">Track order</div>
              <h1 className="h1 st-title">
                {activeTab === "riwayat" ? "Riwayat order kamu." : "Cek status order."}
              </h1>
              <p className="st-sub">
                {activeTab === "riwayat"
                  ? "Semua order dari browser ini nyimpen di sini."
                  : "Masukin ID order, langsung keliatan progress-nya."}
              </p>
            </div>
          </header>

          {/* Tab switcher */}
          <div className="st-tabs" role="tablist" aria-label="Pilih tampilan">
            <button
              id="tab-cek"
              role="tab"
              type="button"
              aria-selected={activeTab === "cek"}
              aria-controls="panel-cek"
              className={`st-tab${activeTab === "cek" ? " is-active" : ""}`}
              onClick={() => switchTab("cek")}
            >
              <Activity size={15} />
              Cek Status
            </button>
            <button
              id="tab-riwayat"
              role="tab"
              type="button"
              aria-selected={activeTab === "riwayat"}
              aria-controls="panel-riwayat"
              className={`st-tab${activeTab === "riwayat" ? " is-active" : ""}`}
              onClick={() => switchTab("riwayat")}
            >
              <History size={15} />
              Riwayat
            </button>
          </div>

          <div
            id="panel-cek"
            role="tabpanel"
            aria-labelledby="tab-cek"
            tabIndex={0}
            hidden={activeTab !== "cek"}
          >
            {activeTab === "cek" ? <TabCekStatus settings={settings} /> : null}
          </div>
          <div
            id="panel-riwayat"
            role="tabpanel"
            aria-labelledby="tab-riwayat"
            tabIndex={0}
            hidden={activeTab !== "riwayat"}
          >
            {activeTab === "riwayat" ? <TabRiwayat /> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
