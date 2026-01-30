// File: src/pages/Pay.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
// STEP 1: Import WhatsAppInput
import WhatsAppInput from "../components/WhatsAppInput";
import { Check, X, Upload, Loader, Info, AlertCircle } from "lucide-react";

function calcTotal(subtotal, percent) {
  const disc = Math.round((subtotal * (percent || 0)) / 100);
  return { discount: disc, total: Math.max(0, subtotal - disc) };
}

// Skeleton loader untuk QRIS
function QRISSkeleton() {
  return (
    <div className="qris-skeleton" role="status" aria-label="Memuat QRIS">
      <div className="skeleton-shimmer" style={{ width: '100%', height: 300, borderRadius: 8, backgroundColor: '#f0f0f0' }} />
    </div>
  );
}

// STEP 7: Update Success Modal (add customerWhatsApp props)
function OrderSuccessModal({ open, orderCode, onClose, waUrl, statusUrl, onCopied, customerWhatsApp }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && typeof window !== 'undefined' && window.confetti) {
      window.confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [open]);

  if (!open) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(orderCode);
    } catch {
      // Fallback
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (typeof onCopied === "function") onCopied();
  }

  return (
    <div className="modal-backdrop animate-fade-in" role="dialog" aria-modal="true">
      <div className="modal animate-scale-up">
        <div className="modal-head">
          <div>
            <div className="modal-title">
              <Check className="icon-success" size={24} style={{ marginRight: 8 }} />
              Order berhasil dibuat
            </div>
            <div className="modal-sub">Simpan ID order untuk cek status.</div>
          </div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="success-badge">
            <Check size={48} />
          </div>

          <div className="order-code">
            <div className="muted">ID Order</div>
            <div className="order-code-value">{orderCode}</div>
          </div>

          {/* Menampilkan nomor WA di modal success */}
          {customerWhatsApp && (
            <div className="info-box" style={{ marginBottom: 16 }}>
              <Info size={16} />
              <span>Admin akan menghubungi ke: <b>{customerWhatsApp}</b></span>
            </div>
          )}

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <button 
              className={`btn ${copied ? 'btn-success' : 'btn-ghost'}`}
              onClick={copy}
              disabled={copied}
            >
              {copied ? <><Check size={16} /> Tersalin</> : 'Salin ID'}
            </button>
            <a className="btn btn-primary" href={waUrl} target="_blank" rel="noreferrer">
              Hubungi admin
            </a>
            <Link className="btn btn-ghost" to={statusUrl}>
              Cek Status
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// Komponen Preview File - Diperbaiki logic displaynya
function FileUploadPreview({ file, previewUrl, onRemove, uploading }) {
  if (!file && !previewUrl) return null;

  return (
    <div className="file-preview-card animate-slide-up" style={{ marginTop: 12, border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
      <div className="file-preview-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="file-info" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Check className="icon-success" size={16} color="green" />
          <span className="file-name" style={{ fontSize: 13, fontWeight: 500 }}>{file?.name}</span>
          <span className="file-size" style={{ fontSize: 12, color: '#666' }}>{file ? (file.size / 1024).toFixed(0) : 0} KB</span>
        </div>
        {!uploading && (
          <button className="icon-btn icon-btn-sm" onClick={onRemove} type="button">
            <X size={16} />
          </button>
        )}
      </div>
      
      {/* Pastikan gambar muncul */}
      {previewUrl && (
        <div className="proof-preview" style={{ width: '100%', overflow: 'hidden', borderRadius: 6, border: '1px solid #f0f0f0' }}>
          <img 
            src={previewUrl} 
            alt="Preview bukti pembayaran" 
            style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 300, objectFit: 'contain' }}
          />
        </div>
      )}

      {uploading && (
        <div className="upload-progress" style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#666' }}>
          <Loader className="spinner" size={16} />
          <span>Mengupload...</span>
        </div>
      )}
    </div>
  );
}

export default function Pay() {
  const nav = useNavigate();
  const cart = useCart();
  const { promo } = usePromo();
  const toast = useToast();

  usePageMeta({ title: "Pembayaran", description: "Scan QRIS, upload bukti, dan konfirmasi." });

  const [snapshot, setSnapshot] = useState(cart.items);
  
  useEffect(() => {
    if (cart.items.length > 0) setSnapshot(cart.items);
  }, [cart.items]);

  const items = snapshot || [];
  const subtotal = useMemo(() => items.reduce((sum, x) => sum + (x.price_idr * x.qty), 0), [items]);
  const { discount, total } = calcTotal(subtotal, promo.percent);

  // Settings & WhatsApp State
  const [settings, setSettings] = useState({ whatsapp: { number: "6283136049987" } });
  const waNumber = settings?.whatsapp?.number || "6283136049987";
  const qrisUrl = "/qris_payment.jpeg";

  // STEP 2: State WhatsApp
  const [customerWhatsApp, setCustomerWhatsApp] = useState('');
  const [isWaValid, setIsWaValid] = useState(false);

  // Form States
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const [orderCode, setOrderCode] = useState("");
  const [qrisLoaded, setQrisLoaded] = useState(false);

  // Effect untuk Preview URL Object
  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    // Cleanup memory
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    fetchSettings().then((s) => setSettings({ whatsapp: s.whatsapp || { number: "6283136049987" } })).catch(() => {});
  }, []);

  useEffect(() => {
    if (!ok && items.length === 0) nav("/checkout", { replace: true });
  }, [items.length, nav, ok]);

  // STEP 6: Update summaryText (tambahkan customerWhatsApp)
  const summaryText = useMemo(() => {
    const lines = items.map((x) => `- ${x.product_name} • ${x.variant_name} (${x.duration_label}) x${x.qty} = ${formatIDR(x.price_idr * x.qty)}`);
    lines.push(`Subtotal: ${formatIDR(subtotal)}`);
    if (promo?.percent) lines.push(`Promo ${promo.code}: -${promo.percent}%`);
    lines.push(`Total: ${formatIDR(total)}`);
    if (customerWhatsApp) lines.push(`\nKontak WA: ${customerWhatsApp}`);
    return lines.join("\n");
  }, [items, subtotal, total, promo, customerWhatsApp]);

  const waUrl = useMemo(() => {
    const text = encodeURIComponent(
      `Halo kak, saya sudah bayar.\n\nID Order: ${orderCode || "(menunggu)"}\nKontak WA: ${customerWhatsApp || "-"}\n\n${summaryText}\n\nMohon diproses yaa`
    );
    return `https://wa.me/${waNumber}?text=${text}`;
  }, [waNumber, orderCode, summaryText, customerWhatsApp]);

  const statusUrl = orderCode ? `/status?order=${encodeURIComponent(orderCode)}` : "/status";

  function onPickFile(fileObj) {
    setErr("");
    if (!fileObj) { setFile(null); return; }

    const ext = String(fileObj.name.split(".").pop() || "").toLowerCase();
    if (!["jpg", "jpeg", "png", "webp"].includes(ext)) {
      toast.error("Format file harus JPG/JPEG/PNG/WEBP.");
      setFile(null);
      return;
    }
    if (fileObj.size > 5 * 1024 * 1024) {
      toast.error("File terlalu besar (max 5MB).");
      setFile(null);
      return;
    }
    setFile(fileObj);
  }

  async function uploadProof(fileObj) {
    setUploading(true);
    try {
      const ext = (fileObj.name.split(".").pop() || "jpg").toLowerCase();
      const safeExt = ["jpg","jpeg","png","webp"].includes(ext) ? ext : "jpg";
      const visitor_id = getVisitorIdAsUUID();
      const path = `proofs/${visitor_id}/${Date.now()}-${Math.random().toString(16).slice(2)}.${safeExt}`;

      const { error: upErr } = await supabase.storage.from("payment-proofs").upload(path, fileObj, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from("payment-proofs").getPublicUrl(path);
      return data.publicUrl;
    } finally {
      setUploading(false);
    }
  }

  // STEP 3: Update createOrderWithStock (include p_customer_whatsapp)
  async function createOrderWithStock(payment_proof_url, nextCode) {
    const visitor_id = getVisitorIdAsUUID();

    const { data, error } = await supabase.rpc('create_order_with_stock_check', {
      p_visitor_id: visitor_id,
      p_order_code: nextCode,
      p_items: items,
      p_promo_code: promo?.code || null,
      p_subtotal_idr: subtotal,
      p_discount_percent: promo?.percent || 0,
      p_total_idr: total,
      p_payment_proof_url: payment_proof_url,
      p_customer_whatsapp: customerWhatsApp // ✅ DITAMBAHKAN
    });

    if (error) throw error;
    if (!data || data.length === 0) throw new Error("Gagal membuat order");
    
    return data[0];
  }

  // STEP 4: Update onConfirmPaid (validasi WA di awal)
  async function onConfirmPaid() {
    setErr("");

    // ✅ VALIDASI WA DI AWAL
    if (!customerWhatsApp || !isWaValid) {
      const t = "Mohon isi nomor WhatsApp dengan benar";
      setErr(t);
      toast.error(t);
      return;
    }

    if (!file) {
      const t = "Wajib upload screenshot bukti pembayaran dulu.";
      setErr(t);
      toast.error(t);
      return;
    }

    setBusy(true);
    const loadingId = toast.loading("Memproses order…");
    
    try {
      const proofUrl = await uploadProof(file);
      let final;
      let code = "";
      
      // Retry logic for unique order code
      for (let i = 0; i < 5; i++) {
        code = makeOrderCode(4);
        try {
          final = await createOrderWithStock(proofUrl, code);
          break;
        } catch (e) {
          if (e?.code === "23505") continue; // Unique violation, retry
          throw e; // Other errors, throw
        }
      }
      
      if (!final) throw new Error("Gagal membuat ID order unik.");

      setOrderCode(code);
      setOk(true);
      toast.remove(loadingId);
      toast.success("Order berhasil dibuat!");
      cart.clear();
      
    } catch (e) {
      toast.remove(loadingId);
      const msg = e?.message || String(e);
      setErr("Gagal: " + msg);
      
      if (msg.includes("customer_whatsapp")) {
        toast.error("Database error: Kolom WhatsApp belum ada.");
      } else if (msg.includes("stock")) {
        toast.error("Stock tidak mencukupi.");
      } else {
        toast.error("Gagal memproses order.");
      }
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = !busy && file && customerWhatsApp && isWaValid;

  return (
    <div className="page with-sticky-cta">
      <section className="section reveal">
        <div className="container section-head">
          <div>
            <h1 className="h1">Pembayaran</h1>
            <p className="muted">Isi nomor WhatsApp, scan QRIS, upload bukti, lalu konfirmasi.</p>
          </div>
        </div>

        <div className="container" style={{ marginBottom: 14 }}>
          <CheckoutSteps current="pay" />
        </div>

        <div className="container pay-grid">
          <div className="card pad">
            
            {/* STEP 5: WhatsApp Input SEBELUM Total */}
            <WhatsAppInput
              value={customerWhatsApp}
              onChange={setCustomerWhatsApp}
              onValidChange={setIsWaValid}
              required
              autoFocus
              rememberLast
              showHelper
            />

            <div className="divider" />

            <h3 className="h3">Total yang harus dibayar</h3>
            <div className="pay-total">{formatIDR(total)}</div>
            <div className="hint subtle">
              Subtotal: <b>{formatIDR(subtotal)}</b> • Diskon: <b>-{formatIDR(discount)}</b>
            </div>

            <div className="divider" />

            {/* Area QRIS dengan Error Handling & Skeleton */}
            <div className="qris-wrap" style={{ minHeight: 300, display: 'flex', justifyContent: 'center' }}>
              {!qrisLoaded && <QRISSkeleton />}
              <img 
                src={qrisUrl} 
                alt="QRIS pembayaran" 
                className="qris-img"
                onLoad={() => setQrisLoaded(true)}
                onError={(e) => {
                  e.target.style.display = 'none'; // Hide broken image
                  // Fallback if image fails
                }}
                style={{ display: qrisLoaded ? 'block' : 'none', maxWidth: '100%', height: 'auto' }}
              />
            </div>

            <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <a className="btn btn-ghost btn-sm" href={qrisUrl} target="_blank" rel="noreferrer">
                Buka QRIS Fullscreen
              </a>
            </div>

            <div className="divider" />

            <label className="label">
              <Upload size={16} style={{ marginRight: 6 }} />
              Upload bukti pembayaran <span className="required">*</span>
            </label>
            
            {!file ? (
              <label className="file-upload-area" style={{ cursor: 'pointer' }}>
                <input
                  className="input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onPickFile(f);
                    e.target.value = "";
                  }}
                  style={{ display: 'none' }}
                />
                <div style={{ textAlign: 'center', padding: 20, border: '2px dashed #ddd', borderRadius: 8 }}>
                  <Upload size={32} style={{ margin: '0 auto 10px', color: '#999' }} />
                  <div><b>Klik untuk upload</b></div>
                  <div className="hint subtle">JPG/PNG/WEBP (max 5MB)</div>
                </div>
              </label>
            ) : (
              // Menampilkan preview dengan komponen yang diperbaiki
              <FileUploadPreview
                file={file}
                previewUrl={previewUrl}
                onRemove={() => { setFile(null); setPreviewUrl(""); }}
                uploading={uploading}
              />
            )}

            {err && (
              <div className="alert alert-error" style={{ marginTop: 16 }}>
                <AlertCircle size={20} /> {err}
              </div>
            )}

            <div className="row" style={{ gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <button 
                className="btn btn-primary"
                disabled={!canSubmit}
                onClick={onConfirmPaid}
              >
                {busy ? <><Loader className="spinner" size={18} /> Memproses...</> : <><Check size={18} /> Aku sudah bayar</>}
              </button>
              <Link className="btn btn-ghost" to="/checkout">Kembali</Link>
            </div>
          </div>

          {/* Right Column: Summary */}
          <div className="card pad">
            <h3 className="h3">Ringkasan belanja</h3>
            <div className="cart-list">
              {items.map((x) => (
                <div key={x.variant_id} className="cart-row">
                  <div className="cart-meta">
                    <div className="cart-title">{x.product_name}</div>
                    <div className="cart-sub">{x.variant_name} • {x.duration_label}</div>
                    <div className="cart-sub">{formatIDR(x.price_idr)} × {x.qty}</div>
                  </div>
                  <div className="order-total">{formatIDR(x.price_idr * x.qty)}</div>
                </div>
              ))}
            </div>

            <div className="divider" />

            <div className="totals">
              <div className="tot-row"><span>Subtotal</span><b>{formatIDR(subtotal)}</b></div>
              <div className="tot-row"><span>Diskon</span><b>- {formatIDR(discount)}</b></div>
              <div className="tot-row tot-big"><span>Total</span><b>{formatIDR(total)}</b></div>
            </div>

            <div className="divider" />

            <a className="btn btn-ghost btn-wide" href={waUrl} target="_blank" rel="noreferrer">
              Chat admin (opsional)
            </a>
          </div>
        </div>
      </section>

      {/* Sticky CTA for Mobile */}
      {!ok && (
        <div className="sticky-cta">
          <div className="sticky-cta-left">
            <div className="sticky-cta-title">Total</div>
            <div className="sticky-cta-value">{formatIDR(total)}</div>
          </div>
          <button 
            className="btn btn-primary"
            disabled={!canSubmit}
            onClick={onConfirmPaid}
          >
            {busy ? "Memproses..." : "Aku sudah bayar"}
          </button>
        </div>
      )}

      {/* STEP 8: Success Modal dengan customerWhatsApp props */}
      <OrderSuccessModal
        open={ok}
        orderCode={orderCode}
        customerWhatsApp={customerWhatsApp} // ✅ DITAMBAHKAN
        onClose={() => setOk(false)}
        waUrl={waUrl}
        statusUrl={statusUrl}
        onCopied={() => toast.success("ID order disalin")}
      />
    </div>
  );
}