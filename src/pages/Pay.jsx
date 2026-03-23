import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import {
  Check,
  CheckCircle2,
  FileText,
  Info,
  Loader,
  MessageSquare,
  Phone,
  Receipt,
  Upload,
  WalletCards,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useCart } from "../context/CartContext";
import { usePromo } from "../hooks/usePromo";
import { formatIDR } from "../lib/format";
import { fetchSettings } from "../lib/api";
import { getVisitorIdAsUUID } from "../lib/visitor";
import { makeOrderCode } from "../lib/orderCode";
import CheckoutSteps from "../components/CheckoutSteps";
import { useToast } from "../context/ToastContext";
import { usePageMeta } from "../hooks/usePageMeta";
import WhatsAppInput from "../components/WhatsAppInput";

function calcTotal(subtotal, percent) {
  const discount = Math.round((subtotal * (percent || 0)) / 100);
  return { discount, total: Math.max(0, subtotal - discount) };
}

function QRISSkeleton() {
  return (
    <div className="qris-skeleton" role="status" aria-label="Memuat QRIS">
      <div className="qris-skeletonBox" />
    </div>
  );
}

function OrderSuccessModal({ open, orderCode, customerWhatsApp, notes, waUrl, statusUrl, onClose, onCopied }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && typeof window !== "undefined" && window.confetti) {
      window.confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(orderCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      onCopied?.();
    } catch {
      // Ignore clipboard failure.
    }
  }

  return createPortal(
    <div className="modal-backdrop pay-overlay" onMouseDown={onClose} role="presentation">
      <div className="modal pay-successModal" role="dialog" aria-modal="true" aria-label="Order berhasil" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">Order aktif</div>
            <div className="modal-sub">{orderCode}</div>
          </div>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Tutup">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="pay-successIcon">
            <CheckCircle2 size={34} />
          </div>

          <div className="pay-successGrid">
            <div className="pay-successCell">
              <span>WA</span>
              <b>{customerWhatsApp}</b>
            </div>
            <div className="pay-successCell">
              <span>Catatan</span>
              <b>{notes ? "Terkirim" : "-"}</b>
            </div>
          </div>

          <div className="row wrap">
            <button className="btn btn-ghost" type="button" onClick={copyCode}>
              {copied ? "Tersalin" : "Salin ID"}
            </button>
            <a className="btn" href={waUrl} target="_blank" rel="noreferrer">
              Admin
            </a>
            <Link className="btn btn-ghost" to={statusUrl}>
              Status
            </Link>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function FileUploadPreview({ file, previewUrl, onRemove, uploading }) {
  if (!file && !previewUrl) return null;

  return (
    <div className="file-preview-card">
      <div className="file-preview-header">
        <div className="file-info">
          <Check size={16} />
          <span className="file-name">{file?.name}</span>
          <span className="file-size">{file ? `${(file.size / 1024).toFixed(0)} KB` : ""}</span>
        </div>
        {!uploading ? (
          <button className="icon-btn icon-btn-sm" onClick={onRemove} type="button" aria-label="Hapus file">
            <X size={16} />
          </button>
        ) : null}
      </div>

      {previewUrl ? (
        <div className="proof-preview">
          <img src={previewUrl} alt="Preview bukti pembayaran" className="proof-preview-img" />
        </div>
      ) : null}

      {uploading ? (
        <div className="upload-progress">
          <Loader className="spinner" size={16} />
          <span>Mengupload...</span>
        </div>
      ) : null}
    </div>
  );
}

export default function Pay() {
  const nav = useNavigate();
  const cart = useCart();
  const { promo } = usePromo();
  const toast = useToast();

  usePageMeta({
    title: "Pembayaran",
    description: "Pembayaran QRIS, upload bukti, dan konfirmasi order.",
  });

  const [snapshot, setSnapshot] = useState(() => (Array.isArray(cart.items) ? cart.items : []));

  useEffect(() => {
    if (Array.isArray(cart.items) && cart.items.length > 0) setSnapshot(cart.items);
  }, [cart.items]);

  const items = snapshot;
  const promoPercent = Number(promo?.percent || 0);
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price_idr * item.qty, 0), [items]);
  const { discount, total } = calcTotal(subtotal, promoPercent);
  const itemCount = useMemo(() => items.reduce((sum, item) => sum + Number(item.qty || 0), 0), [items]);

  const [settings, setSettings] = useState({ whatsapp: { number: "6283136049987" } });
  const waNumber = settings?.whatsapp?.number || "6283136049987";
  const qrisUrl = "/qris_payment.jpeg";

  const [customerWhatsApp, setCustomerWhatsApp] = useState("");
  const [isWaValid, setIsWaValid] = useState(false);
  const [notes, setNotes] = useState("");

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [ok, setOk] = useState(false);
  const [orderCode, setOrderCode] = useState("");
  const [qrisLoaded, setQrisLoaded] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  useEffect(() => {
    fetchSettings()
      .then((result) => setSettings({ whatsapp: result.whatsapp || { number: "6283136049987" } }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!ok && items.length === 0) nav("/checkout", { replace: true });
  }, [items.length, nav, ok]);

  const noteText = useMemo(() => String(notes || "").trim(), [notes]);

  const summaryText = useMemo(() => {
    const rows = items.map(
      (item) =>
        `- ${item.product_name} / ${item.variant_name} / ${item.duration_label} x${item.qty} = ${formatIDR(item.price_idr * item.qty)}`
    );
    rows.push(`Subtotal: ${formatIDR(subtotal)}`);
    rows.push(`Diskon: ${formatIDR(discount)}`);
    rows.push(`Total: ${formatIDR(total)}`);
    if (customerWhatsApp) rows.push(`WA: ${customerWhatsApp}`);
    if (noteText) rows.push(`Catatan: ${noteText}`);
    return rows.join("\n");
  }, [customerWhatsApp, discount, items, noteText, subtotal, total]);

  const waUrl = useMemo(() => {
    const text = encodeURIComponent(
      `Halo, saya sudah bayar.\n\nID Order: ${orderCode || "(menunggu)"}\n${summaryText}\n\nMohon diproses.`
    );
    return `https://wa.me/${waNumber}?text=${text}`;
  }, [orderCode, summaryText, waNumber]);

  const statusUrl = orderCode ? `/status?order=${encodeURIComponent(orderCode)}` : "/status";

  const quickSummary = [
    { icon: Receipt, label: "Item", value: itemCount },
    { icon: MessageSquare, label: "Promo", value: promoPercent ? `${promoPercent}%` : "-" },
    { icon: WalletCards, label: "Harus dibayar", value: formatIDR(total), strong: true },
  ];

  function onPickFile(fileObject) {
    setErrorText("");
    if (!fileObject) {
      setFile(null);
      return;
    }

    const ext = String(fileObject.name.split(".").pop() || "").toLowerCase();
    if (!["jpg", "jpeg", "png", "webp"].includes(ext)) {
      toast.error("File harus JPG, JPEG, PNG, atau WEBP.");
      setFile(null);
      return;
    }
    if (fileObject.size > 5 * 1024 * 1024) {
      toast.error("Maksimal 5MB.");
      setFile(null);
      return;
    }

    setFile(fileObject);
  }

  async function uploadProof(fileObject) {
    setUploading(true);
    try {
      const ext = (fileObject.name.split(".").pop() || "jpg").toLowerCase();
      const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
      const visitorId = getVisitorIdAsUUID();
      const path = `proofs/${visitorId}/${Date.now()}-${Math.random().toString(16).slice(2)}.${safeExt}`;

      const { error } = await supabase.storage.from("payment-proofs").upload(path, fileObject, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;

      const { data } = supabase.storage.from("payment-proofs").getPublicUrl(path);
      return data.publicUrl;
    } finally {
      setUploading(false);
    }
  }

  async function createOrderWithStock(paymentProofUrl, nextCode) {
    const visitorId = getVisitorIdAsUUID();
    const payload = {
      p_visitor_id: visitorId,
      p_order_code: nextCode,
      p_items: items,
      p_promo_code: promo?.code || null,
      p_subtotal_idr: subtotal,
      p_discount_percent: promoPercent,
      p_total_idr: total,
      p_payment_proof_url: paymentProofUrl,
      p_customer_whatsapp: customerWhatsApp,
    };

    const rpcPayload = noteText ? { ...payload, p_notes: noteText } : payload;
    const { data, error } = await supabase.rpc("create_order_with_stock_check", rpcPayload);

    if (error) {
      const message = error?.message || String(error);
      if (noteText && (message.includes("notes") || message.includes("p_notes") || message.includes("function"))) {
        throw new Error("Fitur catatan belum aktif di database.");
      }
      throw error;
    }

    if (!data || data.length === 0) throw new Error("Gagal membuat order.");
    return data[0];
  }

  async function onConfirmPaid() {
    setErrorText("");

    if (!customerWhatsApp || !isWaValid) {
      const text = "Isi WhatsApp yang valid.";
      setErrorText(text);
      toast.error(text);
      return;
    }

    if (!file) {
      const text = "Upload bukti dulu.";
      setErrorText(text);
      toast.error(text);
      return;
    }

    setBusy(true);
    const loadingId = toast.loading("Memproses order...");

    try {
      const proofUrl = await uploadProof(file);
      let createdOrder = null;
      let generatedCode = "";

      for (let index = 0; index < 5; index += 1) {
        generatedCode = makeOrderCode(4);
        try {
          createdOrder = await createOrderWithStock(proofUrl, generatedCode);
          break;
        } catch (error) {
          if (error?.code === "23505") continue;
          throw error;
        }
      }

      if (!createdOrder) throw new Error("Gagal membuat ID order.");

      setOrderCode(generatedCode);
      setOk(true);
      cart.clear();
      toast.remove(loadingId);
      toast.success("Order berhasil dibuat.");
    } catch (error) {
      const message = error?.message || String(error);
      setErrorText(message);
      toast.remove(loadingId);
      toast.error(message.includes("catatan") ? message : "Gagal memproses order.");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = !busy && file && customerWhatsApp && isWaValid;

  return (
    <div className="page with-sticky-cta pay-min">
      <section className="section reveal pay-min-hero">
        <div className="container">
          <div className="pay-min-head">
            <div>
              <h1 className="h1">Bayar</h1>
            </div>

            <div className="pay-min-quick">
              {quickSummary.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className={`pay-min-quickCell ${item.strong ? "strong" : ""}`}>
                    <div className="pay-min-quickTop">
                      <Icon size={15} />
                      <small>{item.label}</small>
                    </div>
                    <span>{item.value}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="container" style={{ marginBottom: 14 }}>
          <CheckoutSteps current="pay" />
        </div>

        <div className="container pay-min-grid">
          <section className="card pad pay-min-main">
            <div className="pay-min-block">
              <div className="pay-min-blockHead">
                <Phone size={16} />
                <span>Kontak</span>
              </div>
              <WhatsAppInput
                value={customerWhatsApp}
                onChange={setCustomerWhatsApp}
                onValidChange={setIsWaValid}
                required
                autoFocus
                rememberLast
              />
            </div>

            <div className="pay-min-block">
              <div className="pay-min-blockHead">
                <FileText size={16} />
                <span>Catatan</span>
              </div>
              <textarea
                className="input pay-min-notes"
                rows={3}
                maxLength={400}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Opsional"
              />
              <div className="pay-min-noteMeta">
                <span>{notes.length}/400</span>
              </div>
            </div>

            <div className="pay-min-paybox">
              <div className="pay-min-payMeta">
                <div className="pay-min-totalLabel">Nominal yang harus dibayar</div>
                <div className="pay-min-total">{formatIDR(total)}</div>
                <div className="pay-min-totalHint">Scan QRIS sesuai nominal ini.</div>
                <div className="pay-min-breakdown">
                  <div className="pay-min-row">
                    <span>Subtotal sebelum promo</span>
                    <b>{formatIDR(subtotal)}</b>
                  </div>
                  {discount > 0 ? (
                    <div className="pay-min-row">
                      <span>Potongan promo</span>
                      <b>- {formatIDR(discount)}</b>
                    </div>
                  ) : (
                    <div className="pay-min-row">
                      <span>Potongan promo</span>
                      <b>-</b>
                    </div>
                  )}
                </div>
              </div>

              <div className="qris-wrap pay-min-qris">
                {!qrisLoaded ? <QRISSkeleton /> : null}
                <img
                  src={qrisUrl}
                  alt="QRIS pembayaran"
                  className="qris-img"
                  onLoad={() => setQrisLoaded(true)}
                  onError={(event) => {
                    event.target.style.display = "none";
                  }}
                  style={{ display: qrisLoaded ? "block" : "none" }}
                />
              </div>
            </div>

            <div className="row wrap pay-min-links">
              <a className="btn btn-ghost btn-sm" href={qrisUrl} target="_blank" rel="noreferrer">
                QRIS
              </a>
              <a className="btn btn-ghost btn-sm" href={waUrl} target="_blank" rel="noreferrer">
                Admin
              </a>
            </div>

            <div className="pay-min-block">
              <div className="pay-min-blockHead">
                <Upload size={16} />
                <span>Bukti</span>
              </div>

              {!file ? (
                <label className="upload-drop pay-min-upload">
                  <input
                    className="input"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const selectedFile = e.target.files?.[0];
                      if (selectedFile) onPickFile(selectedFile);
                      e.target.value = "";
                    }}
                    style={{ display: "none" }}
                  />
                  <div className="upload-dropInner">
                    <Upload size={26} className="upload-ic" />
                    <div className="upload-title">
                      <b>Upload</b>
                    </div>
                    <div className="hint subtle">JPG / PNG / WEBP</div>
                  </div>
                </label>
              ) : (
                <FileUploadPreview
                  file={file}
                  previewUrl={previewUrl}
                  onRemove={() => {
                    setFile(null);
                    setPreviewUrl("");
                  }}
                  uploading={uploading}
                />
              )}
            </div>

            {errorText ? (
              <div className="alert alert-error mt16">
                <Info size={18} /> {errorText}
              </div>
            ) : null}

            <div className="row wrap mt16">
              <button className="btn btn-wide" disabled={!canSubmit} onClick={onConfirmPaid} type="button">
                {busy ? (
                  <>
                    <Loader className="spinner" size={16} /> Proses
                  </>
                ) : (
                  <>
                    <Check size={16} /> Konfirmasi
                  </>
                )}
              </button>
              <Link className="btn btn-ghost btn-wide" to="/checkout">
                Kembali
              </Link>
            </div>
          </section>

          <aside className="card pad pay-min-side">
            <div className="pay-min-sideHead">
              <span>Order</span>
              <b>{itemCount}</b>
            </div>

            <div className="pay-min-list">
              {items.map((item) => (
                <div key={item.variant_id} className="pay-min-listItem">
                  <div>
                    <div className="pay-min-listTitle">{item.product_name}</div>
                    <div className="pay-min-listMeta">
                      <span>{item.variant_name}</span>
                      <span>{item.duration_label}</span>
                      <span>x{item.qty}</span>
                    </div>
                  </div>
                  <b>{formatIDR(item.price_idr * item.qty)}</b>
                </div>
              ))}
            </div>

            <div className="divider" />

            <div className="pay-min-sideStats">
              <div className="pay-min-sideStat">
                <span>Promo</span>
                <b>{promoPercent ? promo?.code : "-"}</b>
              </div>
              <div className="pay-min-sideStat">
                <span>WA</span>
                <b>{customerWhatsApp || "-"}</b>
              </div>
              <div className="pay-min-sideStat">
                <span>Catatan</span>
                <b>{noteText ? "Ada" : "-"}</b>
              </div>
            </div>

            {noteText ? (
              <div className="pay-min-noteCard">
                <div className="pay-min-noteLabel">Catatan</div>
                <p>{noteText}</p>
              </div>
            ) : null}
          </aside>
        </div>
      </section>

      {!ok ? (
        <div className="sticky-cta">
          <div className="sticky-cta-left">
            <div className="sticky-cta-title">Bayar sekarang</div>
            <div className="sticky-cta-value">{formatIDR(total)}</div>
          </div>
          <button className="btn" disabled={!canSubmit} onClick={onConfirmPaid} type="button">
            {busy ? "Proses" : "Konfirmasi"}
          </button>
        </div>
      ) : null}

      <OrderSuccessModal
        open={ok}
        orderCode={orderCode}
        customerWhatsApp={customerWhatsApp}
        notes={noteText}
        waUrl={waUrl}
        statusUrl={statusUrl}
        onClose={() => setOk(false)}
        onCopied={() => toast.success("ID order disalin")}
      />
    </div>
  );
}
