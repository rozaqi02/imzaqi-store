import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Check, CheckCircle2, FileText, Gift, Info, Loader, Phone, ShieldCheck, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useCart } from "../context/CartContext";
import { usePromo } from "../hooks/usePromo";
import { formatIDR } from "../lib/format";
import { fetchProducts, fetchSettings } from "../lib/api";
import { getVisitorIdAsUUID } from "../lib/visitor";
import { makeOrderCode } from "../lib/orderCode";
import { buildDynamicQrisImage } from "../lib/qris";
import CheckoutSteps from "../components/CheckoutSteps";
import { useToast } from "../context/ToastContext";
import { usePageMeta } from "../hooks/usePageMeta";
import WhatsAppInput from "../components/WhatsAppInput";
import { useDialogA11y } from "../hooks/useDialogA11y";
import { addOrderToHistory } from "../lib/orderHistory";

const EMAIL_IN_TEXT_REGEX = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i;
const BUYER_EMAIL_REQUIREMENT_REGEX =
  /(akun\s*buyer|buyer\s*akun|email\s*(buyer|pembeli)|wajib\s*email|butuh\s*email|email\s*aktivasi|aktivasi\s*akun|account\s*activation|send\s*email)/i;

function calcTotal(subtotal, percent) {
  const discount = Math.round((subtotal * (percent || 0)) / 100);
  return { discount, total: Math.max(0, subtotal - discount) };
}

function sanitizeQty(value) {
  const qty = Math.floor(Number(value || 0));
  if (!Number.isFinite(qty)) return 1;
  return Math.max(1, Math.min(99, qty));
}

function variantNeedsBuyerEmail(item) {
  if (!item) return false;

  if (
    item?.requires_note ||
    item?.require_note ||
    item?.requires_buyer_email ||
    item?.require_buyer_email ||
    item?.needs_buyer_email
  ) {
    return true;
  }

  const blob = [
    item?.product_name,
    item?.variant_name,
    item?.name,
    item?.description,
    item?.duration_label,
    item?.guarantee_text,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return BUYER_EMAIL_REQUIREMENT_REGEX.test(blob);
}

function toFriendlyPayError(error, { hasNotes = false } = {}) {
  const raw = String(error?.message || error || "");

  if (hasNotes && /(notes|p_notes|function)/i.test(raw)) {
    return "Catatan order belum tersedia sekarang. Coba kirim order tanpa catatan.";
  }

  if (/(stock|stok|insufficient|habis|out of stock)/i.test(raw)) {
    return "Stok berubah. Cek ulang keranjang lalu coba lagi.";
  }

  if (/promo/i.test(raw)) {
    return "Kode promo tidak bisa dipakai untuk order ini.";
  }

  if (/(subtotal mismatch|total mismatch|promo mismatch|harga terbaru berubah|mismatch)/i.test(raw)) {
    return "Harga atau promo berubah. Cek ulang keranjang, lalu konfirmasi lagi.";
  }

  return "Order belum bisa diproses. Coba lagi beberapa saat.";
}

function QRISSkeleton() {
  return (
    <div className="qris-skeleton" role="status" aria-label="Memuat QRIS">
      <div className="qris-skeletonBox" />
    </div>
  );
}

function OrderSuccessModal({ open, orderCode, statusUrl, adminWaUrl, onClose, onCopied }) {
  const [copied, setCopied] = useState(false);
  const modalRef = React.useRef(null);

  useDialogA11y({
    open,
    containerRef: modalRef,
    onClose,
    initialFocusSelector: ".icon-btn",
  });

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
      <div
        ref={modalRef}
        className="modal pay-successModal"
        role="dialog"
        aria-modal="true"
        aria-label="Order berhasil"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head pay-successHead">
          <div>
            <div className="modal-title">Order dibuat</div>
            <div className="modal-sub">Simpan ID ini, lalu buka halaman status saat diperlukan.</div>
          </div>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Tutup">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="pay-successHero">
            <div className="pay-successIcon">
              <CheckCircle2 size={34} />
            </div>
            <div className="pay-successKicker">ID ORDER</div>
            <div className="pay-successCode">{orderCode}</div>
            <p className="pay-successLead">ID ini akan dipakai setiap kali kamu ingin mengecek progres order.</p>
          </div>

          <div className="pay-successActions">
            <Link className="btn btn-wide" to={statusUrl}>
              Cek Status
            </Link>
            <button className="btn btn-ghost" type="button" onClick={copyCode}>
              {copied ? "Tersalin" : "Salin ID"}
            </button>
            <a className="btn btn-ghost" href={adminWaUrl} target="_blank" rel="noreferrer">
              Hubungi Admin
            </a>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ConfirmPaymentModal({ open, onConfirm, onCancel, total, items, isFree }) {
  const modalRef = React.useRef(null);

  useDialogA11y({
    open,
    containerRef: modalRef,
    onClose: onCancel,
    initialFocusSelector: ".pay-confirmPrimaryBtn",
  });

  if (!open || typeof document === "undefined") return null;

  const itemCount = (items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);

  const checklist = isFree ? [
    "Promo 100% sudah diterapkan ke order ini",
    "Tidak ada pembayaran yang diperlukan",
    "Order akan langsung diproses setelah konfirmasi",
  ] : [
    "Sudah scan QRIS dengan aplikasi m-banking / e-wallet",
    "Nominal transfer sesuai dengan total tagihan di atas",
    "Pembayaran sudah berhasil (bukan pending atau gagal)",
  ];

  return createPortal(
    <div className="modal-backdrop pay-overlay" onMouseDown={onCancel} role="presentation">
      <div
        ref={modalRef}
        className="pay-confirmModal"
        role="dialog"
        aria-modal="true"
        aria-label="Konfirmasi Pembayaran"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="pay-confirmModalHeader">
          <div className="pay-confirmModalHeaderIcon">
            <ShieldCheck size={20} />
          </div>
          <div className="pay-confirmModalHeaderCopy">
            <div className="pay-confirmModalTitle">{isFree ? "Konfirmasi Order Gratis" : "Konfirmasi Pembayaran"}</div>
            <div className="pay-confirmModalSub">{isFree ? "Pastikan semua detail order sudah benar" : "Pastikan semua syarat di bawah terpenuhi"}</div>
          </div>
          <button className="pay-confirmCloseBtn" type="button" onClick={onCancel} aria-label="Tutup">
            <X size={16} />
          </button>
        </div>

        {/* Total Card */}
        <div className="pay-confirmTotalCard">
          <div className="pay-confirmTotalLabel">{isFree ? "Total setelah promo" : "Total yang harus dibayar"}</div>
          <div className="pay-confirmTotalAmount">{isFree ? "Gratis" : formatIDR(total)}</div>
          <div className="pay-confirmTotalMeta">{itemCount} item &bull; {isFree ? "Promo 100%" : "via QRIS"}</div>
        </div>

        {/* Checklist */}
        {/* eslint-disable-next-line jsx-a11y/no-redundant-roles */}
        <ul className="pay-confirmChecklist" role="list">
          {checklist.map((text, i) => (
            <li key={i} className="pay-confirmCheckItem">
              <span className="pay-confirmCheckDot" aria-hidden="true">
                <Check size={11} strokeWidth={3} />
              </span>
              <span>{text}</span>
            </li>
          ))}
        </ul>

        {/* Warning — only for paid orders */}
        {!isFree && (
        <div className="pay-confirmWarning">
          <Info size={14} />
          <span>Konfirmasi palsu akan memperlambat proses order kamu.</span>
        </div>
        )}

        {/* Actions */}
        <div className="pay-confirmActionsNew">
          <button className="pay-confirmPrimaryBtn" type="button" onClick={onConfirm}>
            <Check size={16} strokeWidth={2.5} />
            {isFree ? "Ya, Konfirmasi Order" : "Ya, Saya Sudah Bayar"}
          </button>
          <button className="pay-confirmSecondaryBtn" type="button" onClick={onCancel}>
            Cek Ulang Dulu
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function Pay() {
  const nav = useNavigate();
  const location = useLocation();
  const cart = useCart();
  const { promo, clear: clearPromo } = usePromo();
  const toast = useToast();

  usePageMeta({
    title: "Pembayaran",
    description: "Bayar sesuai total, lalu simpan ID order untuk halaman status.",
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

  const [settings, setSettings] = useState({ whatsapp: { number: "6283136049987" }, qris: {} });
  const waNumber = settings?.whatsapp?.number || "6283136049987";
  const qrisBaseFromSettings = String(settings?.qris?.base_payload || "").trim();
  const qrisBaseFromEnv = String(process.env.REACT_APP_QRIS_BASE || "").trim();
  const qrisBase = qrisBaseFromSettings || qrisBaseFromEnv;
  const fallbackQrisUrl = String(settings?.qris?.image_url || "").trim() || "/qris_payment.jpeg";

  const [customerWhatsApp, setCustomerWhatsApp] = useState("");
  const [isWaValid, setIsWaValid] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [ok, setOk] = useState(false);
  const [orderCode, setOrderCode] = useState("");
  const [qrisUrl, setQrisUrl] = useState("");
  const [qrisLoaded, setQrisLoaded] = useState(false);
  const [qrisNotice, setQrisNotice] = useState("");
  const [qrisFailed, setQrisFailed] = useState(false);
  const [qrisMode, setQrisMode] = useState("idle");
  const [productIconLookup, setProductIconLookup] = useState({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    fetchSettings()
      .then((result) =>
        setSettings({
          whatsapp: result.whatsapp || { number: "6283136049987" },
          qris: result.qris || {},
        })
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;

    fetchProducts({ useCache: true })
      .then((rows) => {
        if (!active) return;

        const next = {};
        (rows || []).forEach((product) => {
          const url = String(product?.icon_url || "").trim();
          if (!url) return;

          if (product?.id) next[`id:${product.id}`] = url;

          const keyByName = String(product?.name || "").trim().toLowerCase();
          if (keyByName) next[`name:${keyByName}`] = url;
        });

        setProductIconLookup(next);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadQris() {
      setQrisLoaded(false);
      setQrisFailed(false);
      setQrisUrl("");
      setQrisNotice("");
      setQrisMode("idle");

      // Free order (100% promo) — skip QRIS entirely
      if (total === 0) {
        setQrisMode("free");
        return;
      }

      if (!qrisBase) {
        if (!active) return;
        setQrisMode("fallback");
        setQrisUrl(fallbackQrisUrl);
        setQrisNotice("QR statis aktif. Isi QRIS base di admin agar nominal otomatis lagi.");
        return;
      }

      try {
        const { dataUrl } = await buildDynamicQrisImage(qrisBase, total);
        if (!active) return;
        setQrisMode("dynamic");
        setQrisUrl(dataUrl);
      } catch (error) {
        if (!active) return;
        setQrisMode("fallback");
        setQrisUrl(fallbackQrisUrl);
        setQrisNotice(error?.message ? `${error.message} Pakai QR statis.` : "QR statis aktif.");
      }
    }

    loadQris();
    return () => {
      active = false;
    };
  }, [fallbackQrisUrl, qrisBase, total]);

  useEffect(() => {
    if (!ok && !orderCode && items.length === 0) nav("/checkout", { replace: true });
  }, [items.length, nav, ok, orderCode]);

  const noteText = useMemo(() => String(notes || "").trim(), [notes]);
  const hasValidWhatsApp = Boolean(customerWhatsApp && isWaValid);
  const requiredBuyerEmailItems = useMemo(() => items.filter((item) => variantNeedsBuyerEmail(item)), [items]);
  const requiresBuyerEmailNote = requiredBuyerEmailItems.length > 0;
  const hasEmailInNotes = useMemo(() => EMAIL_IN_TEXT_REGEX.test(noteText), [noteText]);
  const missingBuyerEmailNote = requiresBuyerEmailNote && !hasEmailInNotes;
  const requiredEmailProductsText = useMemo(() => {
    const names = Array.from(
      new Set(
        requiredBuyerEmailItems
          .map((item) => String(item?.product_name || item?.variant_name || item?.name || "").trim())
          .filter(Boolean)
      )
    );
    if (!names.length) return "item ini";

    const compact = names.map((name) => (name.length > 24 ? `${name.slice(0, 21).trimEnd()}...` : name));
    if (compact.length === 1) return compact[0];
    if (compact.length === 2) return `${compact[0]} & ${compact[1]}`;
    return `${compact[0]} +${compact.length - 1} lainnya`;
  }, [requiredBuyerEmailItems]);

  const canShowQris = hasValidWhatsApp && !missingBuyerEmailNote;
  const isDynamicQris = qrisMode === "dynamic";
  const qrisFootText = !hasValidWhatsApp
    ? "QR akan terbuka setelah nomor WhatsApp valid."
    : missingBuyerEmailNote
      ? "Lengkapi catatan email buyer agar QRIS terbuka."
      : isDynamicQris
        ? "Nominal QR sudah menyesuaikan total."
        : "QR statis aktif. Bayar sesuai total di ringkasan.";
  const qrisLockTitle = !hasValidWhatsApp ? "QRIS terkunci" : "Butuh catatan buyer";
  const qrisLockDescription = !hasValidWhatsApp
    ? "Isi nomor WhatsApp yang valid agar langkah berikutnya terbuka."
    : `Item ${requiredEmailProductsText} memerlukan email buyer untuk aktivasi akun. Isi email buyer di catatan.`;

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

  const adminWaUrl = useMemo(() => {
    const text = encodeURIComponent(
      `Halo Admin Imzaqi Store, saya sudah bayar.\n\nID Order: ${orderCode || "(menunggu)"}\nTotal: ${formatIDR(
        total
      )}\nItem: ${itemCount}\n\n${summaryText}\n\nMohon dicek dan diproses. Terima kasih.`
    );
    return `https://wa.me/${waNumber}?text=${text}`;
  }, [itemCount, orderCode, summaryText, total, waNumber]);

  const statusUrl = orderCode ? `/status?order=${encodeURIComponent(orderCode)}` : "/status";

  async function buildCanonicalOrderPayload() {
    const latestProducts = await fetchProducts({ includeInactive: true, useCache: false });
    const variantMap = new Map();

    (latestProducts || []).forEach((product) => {
      (product?.product_variants || []).forEach((variant) => {
        variantMap.set(String(variant?.id || ""), {
          product,
          variant,
        });
      });
    });

    const canonicalItems = (items || []).map((item) => {
      const variantId = String(item?.variant_id || "");
      if (!variantId) {
        throw new Error("Item keranjang tidak valid.");
      }

      const entry = variantMap.get(variantId);
      if (!entry) {
        throw new Error("Ada item yang sudah tidak tersedia.");
      }

      const productActive = entry.product?.is_active !== false;
      const variantActive = entry.variant?.is_active !== false;
      if (!productActive || !variantActive) {
        throw new Error("Ada item nonaktif di keranjang.");
      }

      const safeQty = sanitizeQty(item?.qty);
      const safePrice = Math.max(0, Number(entry.variant?.price_idr || 0));

      return {
        variant_id: entry.variant.id,
        product_id: entry.product.id,
        product_name: String(entry.product?.name || item?.product_name || ""),
        variant_name: String(entry.variant?.name || item?.variant_name || ""),
        duration_label: String(entry.variant?.duration_label || item?.duration_label || ""),
        price_idr: safePrice,
        product_icon_url: String(entry.product?.icon_url || item?.product_icon_url || ""),
        description: String(entry.variant?.description || item?.description || ""),
        guarantee_text: String(entry.variant?.guarantee_text || item?.guarantee_text || ""),
        requires_buyer_email: !!entry.variant?.requires_buyer_email,
        qty: safeQty,
      };
    });

    if (!canonicalItems.length) {
      throw new Error("Keranjang kosong.");
    }

    const canonicalSubtotal = canonicalItems.reduce(
      (sum, item) => sum + Number(item.price_idr || 0) * Number(item.qty || 0),
      0
    );

    let canonicalPromoCode = null;
    let canonicalDiscountPercent = 0;
    const requestedPromo = String(promo?.code || "").trim().toUpperCase();

    if (requestedPromo) {
      const { data, error } = await supabase.rpc("validate_promo", {
        p_code: requestedPromo,
        p_visitor_id: getVisitorIdAsUUID(),
      });
      if (!error) {
        const nextPercent = Number(data || 0);
        if (nextPercent > 0) {
          canonicalPromoCode = requestedPromo;
          canonicalDiscountPercent = nextPercent;
        }
      }
    }

    const canonicalDiscount = Math.round((canonicalSubtotal * canonicalDiscountPercent) / 100);
    const canonicalTotal = Math.max(0, canonicalSubtotal - canonicalDiscount);

    return {
      items: canonicalItems,
      subtotal: canonicalSubtotal,
      discountPercent: canonicalDiscountPercent,
      total: canonicalTotal,
      promoCode: canonicalPromoCode,
    };
  }

  async function createOrderWithStock(nextCode, orderDraft) {
    const visitorId = getVisitorIdAsUUID();
    const payload = {
      p_visitor_id: visitorId,
      p_order_code: nextCode,
      p_items: orderDraft.items,
      p_promo_code: orderDraft.promoCode,
      p_subtotal_idr: orderDraft.subtotal,
      p_discount_percent: orderDraft.discountPercent,
      p_total_idr: orderDraft.total,
      p_payment_proof_url: null,
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
    if (missingBuyerEmailNote) {
      const text = "Item tertentu perlu email buyer. Isi email buyer di catatan dulu.";
      setErrorText(text);
      toast.error(text);
      return;
    }

    setBusy(true);
    let loadingId = "";

    try {
      const canonicalOrder = await buildCanonicalOrderPayload();
      const hasPricingMismatch =
        Number(canonicalOrder.subtotal) !== Number(subtotal) ||
        Number(canonicalOrder.discountPercent) !== Number(promoPercent) ||
        Number(canonicalOrder.total) !== Number(total);

      if (hasPricingMismatch) {
        setSnapshot(canonicalOrder.items);
        if (!canonicalOrder.promoCode && promo?.code) {
          clearPromo();
        }

        const syncMessage = "Harga atau promo berubah. Data terbaru sudah disinkronkan, cek ulang lalu konfirmasi lagi.";
        setErrorText(syncMessage);
        toast.info(syncMessage, { duration: 4200 });
        return;
      }

      loadingId = toast.loading("Membuat ID order...");
      let createdOrder = null;
      let generatedCode = "";

      for (let index = 0; index < 5; index += 1) {
        generatedCode = makeOrderCode(4);
        try {
          createdOrder = await createOrderWithStock(generatedCode, canonicalOrder);
          break;
        } catch (error) {
          if (error?.code === "23505") continue;
          throw error;
        }
      }

      if (!createdOrder) throw new Error("Gagal membuat ID order.");

      setOrderCode(generatedCode);
      setOk(true);
      setSnapshot(canonicalOrder.items);
      cart.clear();
      addOrderToHistory({
        order_code: generatedCode,
        created_at: new Date().toISOString(),
        total_idr: canonicalOrder.total,
        status: "pending",
      });
      if (loadingId) toast.remove(loadingId);
      toast.success("ID order berhasil dibuat.");
    } catch (error) {
      const message = toFriendlyPayError(error, { hasNotes: Boolean(noteText) });
      console.warn("Gagal memproses order:", error);
      setErrorText(message);
      if (loadingId) toast.remove(loadingId);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  function renderOrderSummaryContent() {
    return (
      <>
        <div className="pay-orderList">
          {items.map((item) => {
            const iconUrl = resolveItemIconUrl(item);

            return (
              <div key={item.variant_id} className="pay-orderItem">
                <div className="pay-orderItemMain">
                  <div className="pay-orderItemIcon app-productIcon">
                    {iconUrl ? (
                      <img src={iconUrl} alt={`${item.product_name} icon`} loading="lazy" decoding="async" />
                    ) : (
                      <span className="app-productIconFallback">
                        {String(item.product_name || "P")
                          .slice(0, 1)
                          .toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="pay-orderItemCopy">
                    <div className="pay-orderItemName">{item.product_name}</div>
                    <div className="pay-orderItemMeta">
                      {item.variant_name} / {item.duration_label} / x{item.qty}
                    </div>
                  </div>
                </div>
                <b>{formatIDR(item.price_idr * item.qty)}</b>
              </div>
            );
          })}
        </div>

        <div className="pay-orderRows">
          <div className="pay-orderRow">
            <span>Subtotal</span>
            <b>{formatIDR(subtotal)}</b>
          </div>
          {discount > 0 ? (
            <div className="pay-orderRow">
              <span>Promo</span>
              <b>- {formatIDR(discount)}</b>
            </div>
          ) : null}
          <div className="pay-orderRow strong">
            <span>Total</span>
            <b>{formatIDR(total)}</b>
          </div>
        </div>
      </>
    );
  }

  const isFreeOrder = total === 0 && subtotal > 0;
  const canSubmit = !busy && (isFreeOrder ? hasValidWhatsApp && !missingBuyerEmailNote : canShowQris);

  function resolveItemIconUrl(item) {
    const direct = String(item?.product_icon_url || "").trim();
    if (direct) return direct;

    if (item?.product_id) {
      const byId = String(productIconLookup[`id:${item.product_id}`] || "").trim();
      if (byId) return byId;
    }

    const keyByName = String(item?.product_name || "").trim().toLowerCase();
    if (keyByName) {
      const byName = String(productIconLookup[`name:${keyByName}`] || "").trim();
      if (byName) return byName;
    }

    return "";
  }

  function renderStageActions(extraClass = "") {
    const klass = `pay-stageActions ${extraClass}`.trim();

    return (
      <div className={klass}>
        <button className="btn btn-wide" disabled={!canSubmit} onClick={() => setShowConfirmModal(true)} type="button">
          {busy ? (
            <>
              <Loader className="spinner" size={16} /> Menyimpan
            </>
          ) : isFreeOrder ? (
            <>
              <Check size={16} /> Konfirmasi Order Gratis
            </>
          ) : (
            <>
              <Check size={16} /> Saya sudah bayar
            </>
          )}
        </button>

        <div className="pay-stageLinks">
          <Link className="btn btn-ghost btn-sm" to="/checkout" state={{ backgroundLocation: location }}>
            Edit order
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page pay-shell pay-page">
      <section className="section reveal pay-shell-hero">
        <div className="container pay-shell-top">
          <div className="pay-shell-copy">
            <h1 className="h1 pay-shell-title">Bayar.</h1>
            <p className="pay-shell-sub">Scan, konfirmasi, simpan ID. Done.</p>
          </div>
        </div>

        <div className="container pay-shell-steps">
          <CheckoutSteps current="pay" />
        </div>

        {items.length > 0 ? (
          <div className="container pay-order-mobileWrap">
            <aside className="card pad pay-card pay-orderMobileCard">
              <div className="pay-orderHead">
                <div>
                  <div className="pay-orderKicker">Order</div>
                  <div className="pay-orderTitle">{itemCount} item</div>
                </div>
                {promoPercent ? <span className="pay-orderPromo">{promo?.code}</span> : null}
              </div>
              {renderOrderSummaryContent()}
            </aside>
          </div>
        ) : null}

        <div className="container pay-shell-grid">
          <div className="pay-mainStack">
            <section className="card pad pay-card pay-contactCard">
              <div className="pay-cardHead">
                <div>
                  <div className="pay-cardKicker">Kontak order</div>
                  <h2 className="h3 pay-cardTitle">WhatsApp</h2>
                </div>
                <span className={`pay-statePill ${isFreeOrder ? "live" : canShowQris ? "live" : ""}`}>
                  {isFreeOrder ? "Free" : canShowQris ? "Ready" : "Locked"}
                </span>
              </div>

              <WhatsAppInput
                value={customerWhatsApp}
                onChange={setCustomerWhatsApp}
                onValidChange={setIsWaValid}
                required
                autoFocus
                rememberLast
                compact
                label="WhatsApp"
                helperText="Dipakai untuk order ini."
                placeholder="08xxxxxxxxxx"
                className="pay-waField"
              />

              <div className={`pay-notePanel ${requiresBuyerEmailNote ? "required" : ""}`}>
                <div className="pay-noteHead">
                  <div className="pay-noteLabelWrap">
                    <FileText size={14} />
                    <span className="pay-noteLabel">Catatan pembeli</span>
                  </div>
                  <span className={`pay-noteState ${requiresBuyerEmailNote ? (missingBuyerEmailNote ? "warn" : "ok") : ""}`}>
                    {requiresBuyerEmailNote ? (missingBuyerEmailNote ? "Wajib email" : "Email terdeteksi") : "Opsional"}
                  </span>
                </div>

                <textarea
                  className="input pay-noteInput"
                  rows={3}
                  maxLength={400}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    requiresBuyerEmailNote
                      ? "Wajib isi email buyer. Contoh: buyer@mail.com"
                      : "Opsional, contoh: minta diproses malam ini."
                  }
                />

                <div className="pay-noteMetaRow">
                  <div className={`pay-noteHintText ${requiresBuyerEmailNote ? (missingBuyerEmailNote ? "warn" : "ok") : ""}`}>
                    {requiresBuyerEmailNote
                      ? missingBuyerEmailNote
                        ? `Item ${requiredEmailProductsText} memerlukan email buyer untuk aktivasi akun.`
                        : "Email buyer sudah terdeteksi di catatan."
                      : "Tambahkan catatan jika ada request khusus untuk admin."}
                  </div>
                  <div className="pay-noteMeta">{notes.length}/400</div>
                </div>
              </div>
            </section>

            <section className="card pad pay-card pay-stageCard">
              <div className="pay-stageGrid">
                <div className="pay-stageMeta">
                  <div className="pay-stageLabel">Total bayar</div>
                  <div className="pay-stageTotal">{isFreeOrder ? "Gratis" : formatIDR(total)}</div>
                  <div className="pay-stageHint">
                    {isFreeOrder
                      ? "Promo 100% diterapkan. Tidak perlu bayar, langsung konfirmasi order."
                      : canShowQris
                        ? "Scan QR, selesaikan pembayaran, lalu simpan ID order."
                        : missingBuyerEmailNote
                          ? "Lengkapi email buyer di catatan agar QRIS terbuka."
                          : "Isi WhatsApp dulu untuk membuka QR."}
                  </div>

                  <div className="pay-stageRows">
                    <div className="pay-stageRow">
                      <span>Subtotal</span>
                      <b>{formatIDR(subtotal)}</b>
                    </div>
                    {discount > 0 ? (
                      <div className="pay-stageRow">
                        <span>Promo</span>
                        <b>- {formatIDR(discount)}</b>
                      </div>
                    ) : null}
                  </div>

                  {errorText ? (
                    <div className="alert alert-error pay-stageAlert">
                      <Info size={18} /> {errorText}
                    </div>
                  ) : null}

                  {renderStageActions("pay-stageActionsDesktop")}
                </div>

                <div className="pay-stageVisual">
                  <div className={`qris-wrap pay-qrisFrame ${canShowQris && !isFreeOrder ? "" : "is-locked"}`}>
                    {isFreeOrder ? (
                      <div className="pay-freePanel">
                        <div className="pay-freePanelIcon" aria-hidden="true">
                          <Gift size={28} strokeWidth={1.8} />
                        </div>
                        <div className="pay-freePanelBadge">Promo 100%</div>
                        <strong className="pay-freePanelTitle">Order Gratis</strong>
                        <p className="pay-freePanelDesc">
                          Promo 100% sudah diterapkan ke order ini.<br />
                          Tidak perlu scan QRIS atau transfer apapun.
                        </p>
                        <div className="pay-freePanelChecks">
                          <div className="pay-freePanelCheck">
                            <Check size={12} strokeWidth={3} />
                            <span>Diskon {promo?.code} aktif</span>
                          </div>
                          <div className="pay-freePanelCheck">
                            <Check size={12} strokeWidth={3} />
                            <span>Total tagihan: Rp 0</span>
                          </div>
                          <div className="pay-freePanelCheck">
                            <Check size={12} strokeWidth={3} />
                            <span>Konfirmasi untuk lanjut</span>
                          </div>
                        </div>
                      </div>
                    ) : canShowQris ? (
                      <>
                        {!qrisLoaded && !qrisFailed ? <QRISSkeleton /> : null}
                        {qrisUrl ? (
                          <img
                            src={qrisUrl}
                            alt="QRIS pembayaran"
                            className="qris-img"
                            onLoad={() => setQrisLoaded(true)}
                            onError={(event) => {
                              event.target.style.display = "none";
                              setQrisFailed(true);
                              setQrisLoaded(true);
                            }}
                            style={{ display: qrisLoaded && !qrisFailed ? "block" : "none" }}
                          />
                        ) : null}
                        {qrisFailed ? <div className="hint subtle">QRIS gagal dimuat. Refresh lalu coba lagi.</div> : null}
                      </>
                    ) : (
                      <div className="pay-qrisLocked">
                        <Phone size={24} />
                        <strong>{qrisLockTitle}</strong>
                        <p>{qrisLockDescription}</p>
                      </div>
                    )}
                  </div>

                  <div className={`pay-stageFoot ${canShowQris && !isDynamicQris && !isFreeOrder ? "warning" : ""}`}>
                    {isFreeOrder ? "Promo 100% aktif — tidak ada pembayaran yang diperlukan." : qrisFootText}
                  </div>
                  {canShowQris && qrisNotice && !isFreeOrder ? (
                    <div className={`hint subtle pay-stageNotice ${!isDynamicQris ? "is-warning" : ""}`}>{qrisNotice}</div>
                  ) : null}
                </div>

                {renderStageActions("pay-stageActionsMobile")}
              </div>
            </section>
          </div>

          {items.length > 0 ? (
            <aside className="card pad pay-card pay-orderDesktop">
              <div className="pay-orderHead">
                <div>
                  <div className="pay-orderKicker">Order</div>
                  <div className="pay-orderTitle">{itemCount} item</div>
                </div>
                {promoPercent ? <span className="pay-orderPromo">{promo?.code}</span> : null}
              </div>
              {renderOrderSummaryContent()}
            </aside>
          ) : null}
        </div>
      </section>

      <ConfirmPaymentModal
        open={showConfirmModal}
        total={total}
        items={items}
        isFree={isFreeOrder}
        onConfirm={() => {
          setShowConfirmModal(false);
          onConfirmPaid();
        }}
        onCancel={() => setShowConfirmModal(false)}
      />

      <OrderSuccessModal
        open={ok}
        orderCode={orderCode}
        statusUrl={statusUrl}
        adminWaUrl={adminWaUrl}
        onClose={() => nav(statusUrl)}
        onCopied={() => toast.success("ID order disalin")}
      />

      {!ok && !orderCode && items.length > 0 ? (
        <div className="pay-stickyCta">
          <div className="pay-stickyCtaInner">
            <div className="pay-stickyCtaInfo">
              <div className="pay-stickyCtaLabel">Total bayar</div>
              <div className="pay-stickyCtaTotal">{isFreeOrder ? "Gratis 🎉" : formatIDR(total)}</div>
            </div>
            <button
              className="btn pay-stickyCtaBtn"
              disabled={!canSubmit}
              onClick={() => setShowConfirmModal(true)}
              type="button"
            >
              {busy ? <><Loader className="spinner" size={16} /> Menyimpan</> : <>Saya sudah bayar</>}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
