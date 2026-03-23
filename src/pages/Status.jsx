import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  Clipboard,
  Clock3,
  MessageSquareText,
  Package,
  Search,
  ShieldAlert,
  Sparkles,
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

function TimelineNode({ active, done, label }) {
  return (
    <div className={"status-min-node" + (active ? " active" : "") + (done ? " done" : "")}>
      <div className="status-min-nodeDot">{done ? <CheckCircle2 size={14} /> : null}</div>
      <span>{label}</span>
    </div>
  );
}

export default function Status() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialParam = searchParams.get("order") || "";
  const toast = useToast();

  usePageMeta({
    title: "Status Order",
    description: "Cek status order berdasarkan ID.",
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
      const text = "Status belum bisa diambil.";
      setMessage(`${text} ${error?.message || error}`);
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

  const StatusIcon = statusMeta.icon;

  return (
    <div className="page status-shell">
      <section className="section reveal status-hero">
        <div className="container">
          <div className="status-heroTop">
            <div className="status-heroCopy">
              <div className="status-kicker">Status</div>
              <h1 className="h1 status-title">Track orderanmu.</h1>
              <p className="status-sub">ID masuk, status keluar.</p>
            </div>
          </div>

          <div className="status-command">
            <div className="status-commandLabelRow">
              <span className="status-commandLabel">ID Order</span>
              <button
                className="status-commandPaste"
                type="button"
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    const normalized = normalizeOrderCode(text);
                    setInput(normalized);
                    toast.success("ID ditempel");
                  } catch {
                    toast.error("Paste manual ya.");
                  }
                }}
              >
                Paste
              </button>
            </div>

            <div className="status-commandSearch">
              <div className="status-commandBox">
                <Search size={16} />
                <input
                  className="input status-commandInput"
                  inputMode="text"
                  autoCapitalize="characters"
                  placeholder="Masukkan ID order (contoh: IMZ-ABCD)"
                  value={input}
                  onChange={(e) => setInput(normalizeOrderCode(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") lookup(input);
                  }}
                />
              </div>

              <button className="btn status-commandBtn" type="button" onClick={() => lookup(input)} disabled={loading}>
                {loading ? "Mencari..." : "Cek status"}
              </button>
            </div>
          </div>

          {message ? <div className="status-message">{message}</div> : null}
        </div>

        <div className="container status-resultShell">
          {!order ? (
            <section className="status-emptyCard">
              <div className="status-emptyGlow" aria-hidden="true" />
              <div className="status-emptyHead">
                <span>{message ? "!" : "IMZ"}</span>
                <strong>{message ? "Belum ketemu" : "Tempel ID"}</strong>
                <small>{message || "Status tampil di sini."}</small>
              </div>
            </section>
          ) : (
            <div className="status-resultGrid">
              <section className="status-mainCard">
                <div className="status-orderHero">
                  <div className={"status-orderPill " + statusMeta.tone}>
                    <StatusIcon size={18} />
                    <span>{prettyStatus(order.status)}</span>
                  </div>

                  <div className="status-orderCodeBlock">
                    <span>ID order</span>
                    <button className="status-orderCode" type="button" onClick={copyOrderCode}>
                      <Clipboard size={14} />
                      <b>{order.order_code}</b>
                    </button>
                  </div>

                  <div className="status-orderDate">
                    <span>Tanggal</span>
                    <b>{new Date(order.created_at).toLocaleDateString("id-ID")}</b>
                  </div>
                </div>

                <div className="status-progressRail">
                  {timeline.map((step, index) => (
                    <React.Fragment key={step.key}>
                      <TimelineNode label={step.label} active={step.active} done={step.done} />
                      {index < timeline.length - 1 ? <div className="status-progressLine" /> : null}
                    </React.Fragment>
                  ))}
                </div>

                <div className="status-metricGrid">
                  <div className="status-metricCard">
                    <span>Total</span>
                    <b>{formatIDR(order.total_idr || 0)}</b>
                  </div>
                  <div className="status-metricCard">
                    <span>Item</span>
                    <b>{itemCount}</b>
                  </div>
                  <div className="status-metricCard">
                    <span>Potong</span>
                    <b>{formatIDR(discountValue)}</b>
                  </div>
                  <div className="status-metricCard">
                    <span>Kode</span>
                    <b>{order.order_code}</b>
                  </div>
                </div>

                <div className="status-balancePanel">
                  <div className="status-balanceBar">
                    <span>Subtotal</span>
                    <div className="status-balanceTrack">
                      <i style={{ width: "100%" }} />
                    </div>
                    <b>{formatIDR(order.subtotal_idr || 0)}</b>
                  </div>
                  <div className="status-balanceBar">
                    <span>Bayar</span>
                    <div className="status-balanceTrack">
                      <i style={{ width: `${order.subtotal_idr ? Math.max(18, (order.total_idr / order.subtotal_idr) * 100) : 100}%` }} />
                    </div>
                    <b>{formatIDR(order.total_idr || 0)}</b>
                  </div>
                </div>

                <div className="status-itemStack">
                  {(order.items || []).map((item, index) => (
                    <div key={index} className="status-itemCard">
                      <div>
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
              </section>

              <aside className="status-sideStack">
                <div className="status-sideCard emphasis">
                  <div className="status-sideHead">
                    <MessageSquareText size={16} />
                    <span>Admin</span>
                  </div>
                  <div className={"status-noteCard" + (order.admin_note ? "" : " empty")}>
                    {order.admin_note || "Belum ada catatan dari admin."}
                  </div>
                </div>

                <div className="status-sideCard">
                  <div className="status-sideHead">
                    <Package size={16} />
                    <span>Catatanmu</span>
                  </div>
                  <div className={"status-noteCard" + (order.notes ? "" : " empty")}>
                    {order.notes || "Tidak ada catatan customer."}
                  </div>
                </div>

                {order.promo_code ? (
                  <div className="status-sideCard">
                    <div className="status-sideHead">
                      <Sparkles size={16} />
                      <span>Promo</span>
                    </div>
                    <div className="status-promoCard">
                      <b>{order.promo_code}</b>
                      <span>{order.discount_percent || 0}%</span>
                    </div>
                  </div>
                ) : null}

                <div className="status-sideCard action">
                  <div className="status-sideHead">
                    <ShieldAlert size={16} />
                    <span>Bantuan</span>
                  </div>
                  <a className="btn btn-wide" href={waUrl} target="_blank" rel="noreferrer">
                    Hubungi Admin
                  </a>
                </div>
              </aside>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
