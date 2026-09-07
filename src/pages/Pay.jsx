import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Check, CheckCircle2, Clock, FileText, Gift, Info, Loader, Mail, Phone, ShieldCheck, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useCart } from "../context/CartContext";
import { usePromo } from "../hooks/usePromo";
import { formatIDR } from "../lib/format";
import { fetchProducts, fetchSettings } from "../lib/api";
import { buildLiveCartItems } from "../lib/liveCartPricing";
import { STORE_WHATSAPP } from "../lib/productCategories";
import { getVisitorIdAsUUID } from "../lib/visitor";
import { makeOrderCode } from "../lib/orderCode";
import { buildDynamicQrisImage } from "../lib/qris";
import CheckoutSteps from "../components/CheckoutSteps";
import "../css/pages/Pay.css";
import "../css/checkout-steps.css";
import { useToast } from "../context/ToastContext";
import { usePageMeta } from "../hooks/usePageMeta";
import WhatsAppInput from "../components/WhatsAppInput";
import { useDialogA11y } from "../hooks/useDialogA11y";
import { addOrderToHistory } from "../lib/orderHistory";
import { getReferralCode } from "../lib/referral";
import { recordCompletedOrder, LOYALTY_PROMO_CODE } from "../lib/loyalty";
import { copyToClipboard } from "../utils/clipboard";
import { warn } from "../lib/log";
import { saveBuyerName } from "../lib/greeting";

const EMAIL_IN_TEXT_REGEX = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i;
const BUYER_EMAIL_REQUIREMENT_REGEX =
  /(akun\s*buyer|buyer\s*akun|email\s*(buyer|pembeli)|wajib\s*email|butuh\s*email|email\s*aktivasi|aktivasi\s*akun|account\s*activation|send\s*email)/i;
const COPY_TIMEOUT_MS = 1800;
const QRIS_UNLOCK_TIMEOUT_MS = 700;
const STORAGE_KEY_BUYER_EMAIL = "imzaqi_last_buyer_email";
const STORAGE_KEY_NOTES = "imzaqi_last_notes";
const PRODUCT_NAME_MAX_LEN = 24;
const PRODUCT_NAME_TRIM_LEN = 21;

const QRIS_INITIAL = {
  url: "",
  loaded: false,
  notice: "",
  failed: false,
  mode: "idle",
};

const QRIS_EXPIRY_MS = 30 * 60 * 1000; // 30 menit

function qrisReducer(state, action) {
  switch (action.type) {
    case "RESET":
      return { ...QRIS_INITIAL };
    case "FREE":
      return { ...state, mode: "free" };
    case "DYNAMIC":
      return { ...state, url: action.url, mode: "dynamic" };
    case "FALLBACK":
      return { ...state, url: action.url, notice: action.notice, mode: "fallback" };
    case "LOADED":
      return { ...state, loaded: true };
    case "FAILED":
      return { ...state, failed: true, loaded: true, mode: "fallback" };
    default:
      return state;
  }
}

function calcTotal(subtotal, percent) {
  const discount = Math.round((subtotal * (percent || 0)) / 100);
  return { discount, total: Math.max(0, subtotal - discount) };
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
    return "Catatan order belum tersedia sekarang. Coba kirim tanpa catatan.";
  }

  if (/(stock|stok|insufficient|habis|out of stock)/i.test(raw)) {
    return "Stok berubah. Cek ulang keranjang, coba lagi.";
  }

  if (/promo/i.test(raw)) {
    return "Kode promo gak bisa dipakai buat order ini.";
  }

  if (/(subtotal mismatch|total mismatch|promo mismatch|harga terbaru berubah|mismatch)/i.test(raw)) {
    return "Harga atau promo berubah. Cek ulang keranjang, konfirmasi lagi.";
  }

  return "Order belum bisa diproses. Coba lagi nanti.";
}

function QRISSkeleton() {
  return (
    <div className="qris-skeleton" role="status" aria-label="Memuat QRIS">
      <div className="qris-skeletonBox" />
    </div>
  );
}

function QRISZoomModal({ open, qrisUrl, onClose }) {
  const [phase, setPhase] = useState("entering");
  const zoomContentRef = useRef(null);

  useDialogA11y({
    open,
    containerRef: zoomContentRef,
    onClose,
    initialFocusSelector: ".pay-zoomClose",
  });

  useEffect(() => {
    if (!open) return;
    const f1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setPhase("open");
      });
    });
    return () => cancelAnimationFrame(f1);
  }, [open]);

  if (!open || !qrisUrl) return null;

  const handleClose = () => {
    setPhase("closing");
    setTimeout(onClose, 200);
  };

  return createPortal(
    <div 
      className={`pay-zoomOverlay pay-zoom-${phase}`} 
      onClick={handleClose}
      role="presentation"
    >
      <div 
        ref={zoomContentRef}
        className="pay-zoomContent" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="QRIS perbesar"
      >
        <button 
          className="pay-zoomClose" 
          type="button" 
          onClick={handleClose} 
          aria-label="Tutup perbesar"
        >
          <X size={22} />
        </button>
        <img src={qrisUrl} alt="QRIS Perbesar" className="pay-zoomImg" />
        <div className="pay-zoomTip">Ketuk di luar gambar untuk kembali</div>
      </div>
    </div>,
    document.body
  );
}

function OrderSuccessModal({ open, orderCode, statusUrl, adminWaUrl, onClose, onCopied, isAcademicOrder = false }) {
  const [copied, setCopied] = useState(false);
  const modalRef = useRef(null);

  useDialogA11y({
    open,
    containerRef: modalRef,
    onClose,
    initialFocusSelector: ".icon-btn",
  });

  useEffect(() => {
    if (open && typeof window !== "undefined" && window.confetti) {
      window.confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.55 },
        colors: ["#4effda", "#25ebc8", "#00d6b4", "#ffd700", "#ff6b9d", "#a78bfa"],
      });
      // Second burst for extra festivity
      setTimeout(() => {
        if (window.confetti) {
          window.confetti({
            particleCount: 60,
            spread: 100,
            origin: { y: 0.4, x: 0.3 },
            colors: ["#4effda", "#ffd700", "#ff6b9d"],
          });
          window.confetti({
            particleCount: 60,
            spread: 100,
            origin: { y: 0.4, x: 0.7 },
            colors: ["#25ebc8", "#a78bfa", "#00d6b4"],
          });
        }
      }, 400);
    }
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  async function copyCode() {
    try {
      await copyToClipboard(orderCode);
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_TIMEOUT_MS);
      onCopied?.();
    } catch {
      // Ignore clipboard failure.
    }
  }

  const academicWaUrl = `https://wa.me/6281232742374?text=${encodeURIComponent(
    `Halo Admin Jasa Akademik, saya telah menyelesaikan pembayaran dengan ID Order: ${orderCode}`
  )}`;

  return createPortal(
    <div className="modal-backdrop pay-overlay" onMouseDown={onClose} role="presentation">
      <div
        ref={modalRef}
        className="modal pay-successModal pay-successModal--animate"
        role="dialog"
        aria-modal="true"
        aria-label="Order berhasil"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* CSS Confetti particles */}
        <div className="pay-celebrationParticles" aria-hidden="true">
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i} className={`pay-celebrationDot pay-celebrationDot--${i % 6}`} />
          ))}
        </div>

        <div className="modal-head pay-successHead">
          <div>
            <p className="pay-successLabel">Order</p>
            <div className="modal-title">Pembayaran siap</div>
            <div className="modal-sub">Salin ID, lalu lacak statusnya kapan saja.</div>
          </div>
          <button className="pay-successClose" type="button" onClick={onClose} aria-label="Tutup">
            <X size={16} strokeWidth={2.4} />
          </button>
        </div>

        <div className="modal-body">
            <div className="pay-successSteps" aria-label="Langkah selanjutnya">
            <div className="pay-successStep is-done">
              <span>1</span>
              Order dibuat
            </div>
            <div className="pay-successStep is-active">
              <span>2</span>
              Salin ID
            </div>
            <div className="pay-successStep">
              <span>3</span>
              Lacak order
            </div>
          </div>

          <div className="pay-successHero">
            {/* Animated glow ring behind icon */}
            <div className="pay-successIconWrap">
              <div className="pay-successGlow" aria-hidden="true" />
              <div className="pay-successIcon pay-successIcon--animate">
                <CheckCircle2 size={34} />
              </div>
            </div>
            <div className="pay-successKicker">ID ORDER</div>
            <div className="pay-successCode pay-successCode--animate">{orderCode}</div>
            <p className="pay-successLead">Simpan ID ini - dipakai setiap kali kamu cek status order.</p>
          </div>

          {isAcademicOrder ? (
            <div className="pay-successActions">
              <a
                className="btn btn-wide btn-primary"
                href={academicWaUrl}
                target="_blank"
                rel="noreferrer"
              >
                Hubungi Admin WA
              </a>
              <Link className="btn btn-ghost" to={statusUrl}>
                Cek Status Order
              </Link>
              <button className="btn btn-ghost" type="button" onClick={copyCode}>
                {copied ? "✓ ID tersalin" : "Salin ID"}
              </button>
            </div>
          ) : (
            <div className="pay-successActions">
              <Link className="btn btn-wide btn-primary" to={statusUrl}>
                Cek Status Order
              </Link>
              <button className="btn btn-ghost" type="button" onClick={copyCode}>
                {copied ? "✓ ID tersalin" : "Salin ID"}
              </button>
              <a className="btn btn-ghost" href={adminWaUrl} target="_blank" rel="noreferrer">
                Chat Admin
              </a>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function useModalCountUp(active, target, duration = 520) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) {
      setValue(0);
      return undefined;
    }

    const end = Number(target) || 0;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    if (reduce || !end) {
      setValue(end);
      return undefined;
    }

    const start = performance.now();
    let frame = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(end * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, target, duration]);

  return value;
}

function ConfirmPaymentModal({ open, onConfirm, onCancel, total, items, isFree }) {
  const modalRef = React.useRef(null);
  const [checked, setChecked] = useState([false, false, false]);
  const animatedTotal = useModalCountUp(open && !isFree, total);

  useEffect(() => {
    if (open) {
      setChecked([false, false, false]);
    }
  }, [open]);

  useDialogA11y({
    open,
    containerRef: modalRef,
    onClose: onCancel,
    initialFocusSelector: ".pay-confirmCloseBtn",
  });

  if (!open || typeof document === "undefined") return null;

  const itemCount = (items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);

  const checklist = isFree ? [
    "Promo 100% udah diterapin ke order ini",
    "Gak perlu bayar apa-apa",
    "Order bakal langsung diproses abis konfirmasi",
  ] : [
    "Udah scan QRIS pake m-banking / e-wallet",
    "Nominal transfer sesuai total tagihan di atas",
    "Pembayaran udah berhasil (bukan pending / gagal)",
  ];

  const handleCheck = (index) => {
    setChecked((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const isAllChecked = checked.every(Boolean);
  const checkedCount = checked.filter(Boolean).length;
  const remainingCount = checklist.length - checkedCount;
  const progressPct = Math.round((checkedCount / checklist.length) * 100);

  return createPortal(
    <div className="modal-backdrop pay-overlay pay-confirmOverlay" onMouseDown={onCancel} role="presentation">
      <div
        ref={modalRef}
        className="pay-confirmModal pay-confirmModal--animate"
        role="dialog"
        aria-modal="true"
        aria-label="Konfirmasi Pembayaran"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="pay-confirmModalHeader">
          <div className="pay-confirmModalHeaderIcon">
            <ShieldCheck size={20} />
          </div>
          <div className="pay-confirmModalHeaderCopy">
            <div className="pay-confirmModalTitle">{isFree ? "Konfirm Order Gratis" : "Konfirmasi Bayar"}</div>
            <div className="pay-confirmModalSub">
              {isAllChecked
                ? "Semua langkah selesai - siap dikonfirmasi"
                : isFree
                  ? "Centang semua detail sebelum lanjut"
                  : "Centang semua opsi buat konfirmasi"}
            </div>
          </div>
          <button className="pay-confirmCloseBtn" type="button" onClick={onCancel} aria-label="Tutup">
            <X size={16} />
          </button>
        </div>

        <div className="pay-confirmModalBody">
          <aside className="pay-confirmAside" aria-label="Ringkasan pembayaran">
            <div className="pay-confirmTotalCard pay-confirmTotalCard--pulse">
              <div className="pay-confirmTotalLabel">{isFree ? "Total setelah promo" : "Total yang harus dibayar"}</div>
              <div className="pay-confirmTotalAmount">
                {isFree ? "Gratis" : formatIDR(animatedTotal)}
              </div>
              <div className="pay-confirmTotalMeta">
                <span>{itemCount} item</span>
                {isFree ? (
                  <span className="pay-confirmTotalBadge is-promo">Promo 100%</span>
                ) : (
                  <span className="pay-confirmTotalBadge is-qris">
                    <Phone size={11} />
                    QRIS
                  </span>
                )}
              </div>
            </div>
          </aside>

          <div className="pay-confirmMain">
            <div className="pay-confirmProgress" aria-live="polite">
              <div className="pay-confirmProgressCopy">
                <span>Progress konfirmasi</span>
                <strong>
                  {checkedCount} dari {checklist.length} selesai
                </strong>
              </div>
              <div className="pay-confirmProgressTrack" aria-hidden="true">
                <span style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            <div className="pay-confirmChecklist" role="group" aria-label="Persyaratan Konfirmasi">
              {checklist.map((text, i) => (
                <label
                  key={text}
                  className={`pay-confirmCheckItem${checked[i] ? " is-done" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={checked[i]}
                    onChange={() => handleCheck(i)}
                    className="pay-confirmCheckbox-hidden"
                  />
                  <span className={`pay-confirmCheckDot${checked[i] ? " is-checked" : ""}`} aria-hidden="true">
                    {checked[i] ? <Check size={11} strokeWidth={3.5} /> : null}
                  </span>
                  <span className="pay-confirmCheckText">{text}</span>
                </label>
              ))}
            </div>

            {!isFree ? (
              <div className="pay-confirmNotice">
                <ShieldCheck size={14} />
                <span>Konfirmasi palsu bikin order makin lambat.</span>
              </div>
            ) : null}

            <div className="pay-confirmActionsNew">
              <button
                className={`pay-confirmPrimaryBtn${isAllChecked ? " is-ready" : ""}`}
                type="button"
                onClick={onConfirm}
                disabled={!isAllChecked}
              >
                <Check size={16} strokeWidth={2.5} />
                {isAllChecked
                  ? isFree
                    ? "Konfirm order"
                    : "Konfirm bayar"
                  : isFree
                    ? `Centang ${remainingCount} lagi`
                    : `Centang ${remainingCount} lagi`}
              </button>
              <button className="pay-confirmSecondaryBtn" type="button" onClick={onCancel}>
                Belum, cek lagi
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function useQrisTimer(active) {
  const TOTAL_MS = QRIS_EXPIRY_MS;
  const [remaining, setRemaining] = useState(TOTAL_MS);
  const startRef = useRef(null);

  useEffect(() => {
    if (!active) {
      setRemaining(TOTAL_MS);
      startRef.current = null;
      return;
    }
    startRef.current = Date.now();
    setRemaining(TOTAL_MS);

    const id = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const left = Math.max(0, TOTAL_MS - elapsed);
      setRemaining(left);
      if (left === 0) clearInterval(id);
    }, 1000);

    return () => clearInterval(id);
  }, [active, TOTAL_MS]);

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const expired = remaining === 0;
  const urgent = remaining <= 5 * 60 * 1000 && remaining > 0; // < 5 menit
  const label = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return { label, expired, urgent, remaining };
}

export default function Pay() {
  const nav = useNavigate();
  const location = useLocation();
  const cart = useCart();
  const { promo, clear: clearPromo, revalidate } = usePromo();
  const toast = useToast();

  usePageMeta({
    title: "Bayar",
    description: "Bayar sesuai total, simpen ID order, terus pantau progress-nya.",
  });

  const [snapshot, setSnapshot] = useState(() => (Array.isArray(cart.items) ? cart.items : []));

  useEffect(() => {
    if (Array.isArray(cart.items) && cart.items.length > 0) setSnapshot(cart.items);
  }, [cart.items]);

  useEffect(() => {
    let alive = true;
    const code = String(promo?.code || "").trim();
    const stored = Number(promo?.percent || 0);
    if (!code || stored <= 0) {
      setPromoPercent(0);
      return undefined;
    }

    revalidate()
      .then((result) => {
        if (!alive) return;
        if (result?.ok && Number(result.percent) > 0) {
          setPromoPercent(Number(result.percent));
          return;
        }
        setPromoPercent(0);
        if (!result?.error && result?.message) {
          toast.info(result.message, { title: "Promo tidak berlaku" });
        }
      })
      .catch(() => {
        if (alive) setPromoPercent(0);
      });

    return () => {
      alive = false;
    };
    // Re-check once when Pay mounts with the session promo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
    if (!Array.isArray(cart.items) || cart.items.length === 0) return undefined;

    buildLiveCartItems(cart.items)
      .then((live) => {
        if (!alive) return;
        setSnapshot(live.items);
        cart.syncPrices?.(live.items);
      })
      .catch((err) => {
        warn("Live cart pricing failed:", err);
      });

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = snapshot;
  const [promoPercent, setPromoPercent] = useState(0);
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + (Number(item.price_idr) || 0) * (Number(item.qty) || 0), 0), [items]);
  const { discount, total } = useMemo(() => calcTotal(subtotal, promoPercent), [subtotal, promoPercent]);
  const itemCount = useMemo(() => items.reduce((sum, item) => sum + Number(item.qty || 0), 0), [items]);

  const isAcademicOrder = useMemo(() => {
    return items.some((item) => {
      if (item.category === "academic" || item.catalog_line === "academic") return true;
      const name = String(item.product_name || item.variant_name || item.name || "").toLowerCase();
      return /turnitin|parafrase|paraphrase|plagiasi|zerogpt|mendeley|skripsi|tesis|jurnal|akademik/.test(name);
    });
  }, [items]);

  const [settings, setSettings] = useState({ whatsapp: { number: STORE_WHATSAPP.app_premium }, qris: {}, qris_academic: {} });
  const waNumber = isAcademicOrder ? STORE_WHATSAPP.academic : (settings?.whatsapp?.number || STORE_WHATSAPP.app_premium);
  const qrisBaseFromSettings = String(settings?.qris?.base_payload || "").trim();
  const qrisBaseFromEnv = String(import.meta.env.VITE_QRIS_BASE || "").trim();
  const qrisBase = qrisBaseFromSettings || qrisBaseFromEnv;
  const fallbackQrisUrl = isAcademicOrder ? "/qris_academic.jpg" : (String(settings?.qris?.image_url || "").trim() || "/qris_payment.jpeg");

  const [customerWhatsApp, setCustomerWhatsApp] = useState("");
  const [isWaValid, setIsWaValid] = useState(false);
  const [buyerEmail, setBuyerEmail] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY_BUYER_EMAIL) || ""; } catch { return ""; }
  });
  const [notes, setNotes] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY_NOTES) || ""; } catch { return ""; }
  });
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [ok, setOk] = useState(false);
  const [orderCode, setOrderCode] = useState("");
  const [qris, dispatchQris] = useReducer(qrisReducer, QRIS_INITIAL);
  const [productIconLookup, setProductIconLookup] = useState({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [qrisJustUnlocked, setQrisJustUnlocked] = useState(false);
  const [qrisShownAt, setQrisShownAt] = useState(null);
  const prevCanShowQrisRef = useRef(false);
  const contactCardRef = useRef(null);
  const buyerEmailRef = useRef(null);
  const focusTimerRef = useRef(null);
  const showPayCta = !ok && !orderCode && items.length > 0;

  // Cleanup focus timer saat unmount
  useEffect(() => () => { if (focusTimerRef.current) window.clearTimeout(focusTimerRef.current); }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_BUYER_EMAIL, buyerEmail); } catch (e) { warn("localStorage buyerEmail:", e); }
  }, [buyerEmail]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_NOTES, notes); } catch (e) { warn("localStorage notes:", e); }
  }, [notes]);

  useEffect(() => {
    let active = true;
    fetchSettings()
      .then((result) => {
        if (!active) return;
        setSettings({
          whatsapp: result.whatsapp || { number: STORE_WHATSAPP.app_premium },
          qris: result.qris || {},
          qris_academic: result.qris_academic || {},
        });
      })
      .catch(() => {});
    return () => { active = false; };
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
      dispatchQris({ type: "RESET" });

      // Free order (100% promo) - skip QRIS entirely
      if (total === 0) {
        dispatchQris({ type: "FREE" });
        return;
      }

      if (isAcademicOrder) {
        const academicBase = String(settings?.qris_academic?.base_payload || "").trim();
        if (academicBase) {
          try {
            const { dataUrl } = await buildDynamicQrisImage(academicBase, total);
            if (!active) return;
            dispatchQris({ type: "DYNAMIC", url: dataUrl, notice: "QRIS khusus Jasa Akademik (AGTA STORE)." });
            return;
          } catch (e) {
            // fallback below
          }
        }
        if (!active) return;
        dispatchQris({
          type: "FALLBACK",
          url: "/qris_academic.jpg",
          notice: "QRIS khusus Jasa Akademik (AGTA_STORE, DIGITAL & KREATIF).",
        });
        return;
      }

      if (!qrisBase) {
        if (!active) return;
        dispatchQris({ type: "FALLBACK", url: fallbackQrisUrl, notice: "QR statis aktif. Isi QRIS base di admin agar nominal otomatis lagi." });
        return;
      }

      try {
        const { dataUrl } = await buildDynamicQrisImage(qrisBase, total);
        if (!active) return;
        dispatchQris({ type: "DYNAMIC", url: dataUrl });
      } catch (error) {
        if (!active) return;
        dispatchQris({ type: "FALLBACK", url: fallbackQrisUrl, notice: error?.message ? `${error.message} Pakai QR statis.` : "QR statis aktif." });
      }
    }

    loadQris();
    return () => {
      active = false;
    };
  }, [fallbackQrisUrl, qrisBase, total, isAcademicOrder, settings]);

  useEffect(() => {
    if (!ok && !orderCode && items.length === 0) {
      const backgroundLocation = location.state?.backgroundLocation;
      nav("/checkout", {
        replace: true,
        ...(backgroundLocation ? { state: { backgroundLocation } } : {}),
      });
    }
  }, [items.length, location.state, nav, ok, orderCode]);

  const noteText = useMemo(() => {
    const parts = [];
    if (buyerEmail.trim()) parts.push(`Email buyer: ${buyerEmail.trim()}`);
    if (notes.trim()) parts.push(notes.trim());
    const ref = getReferralCode();
    if (ref) parts.push(`Ref: ${ref}`);
    return parts.join("\n");
  }, [buyerEmail, notes]);
  const hasValidWhatsApp = Boolean(customerWhatsApp && isWaValid);
  const requiredBuyerEmailItems = useMemo(() => items.filter((item) => variantNeedsBuyerEmail(item)), [items]);
  const requiresBuyerEmailNote = requiredBuyerEmailItems.length > 0;
  const hasEmailInNotes = EMAIL_IN_TEXT_REGEX.test(String(buyerEmail || "").trim());
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

    const compact = names.map((name) => (name.length > PRODUCT_NAME_MAX_LEN ? `${name.slice(0, PRODUCT_NAME_TRIM_LEN).trimEnd()}...` : name));
    if (compact.length === 1) return compact[0];
    if (compact.length === 2) return `${compact[0]} & ${compact[1]}`;
    return `${compact[0]} +${compact.length - 1} lainnya`;
  }, [requiredBuyerEmailItems]);

  const canShowQris = hasValidWhatsApp && !missingBuyerEmailNote;
  const isFreeOrder = total === 0 && subtotal > 0;

  // Start timer when QRIS becomes visible
  const qrisTimerActive = canShowQris && !isFreeOrder && qris.mode !== "idle";
  const qrisTimer = useQrisTimer(qrisTimerActive);

  useEffect(() => {
    if (!prevCanShowQrisRef.current && canShowQris && !isFreeOrder) {
      setQrisJustUnlocked(true);
      const timer = window.setTimeout(() => setQrisJustUnlocked(false), QRIS_UNLOCK_TIMEOUT_MS);
      prevCanShowQrisRef.current = canShowQris;
      return () => window.clearTimeout(timer);
    }
    prevCanShowQrisRef.current = canShowQris;
    return undefined;
  }, [canShowQris, isFreeOrder]);

  const isDynamicQris = qris.mode === "dynamic";
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
    const live = await buildLiveCartItems(items);
    const canonicalItems = live.items;

    const canonicalSubtotal = canonicalItems.reduce(
      (sum, item) => sum + Number(item.price_idr || 0) * Number(item.qty || 0),
      0
    );

    let canonicalPromoCode = null;
    let canonicalDiscountPercent = 0;
    const requestedPromo = String(promo?.code || "").trim().toUpperCase();

    if (requestedPromo) {
      const checked = await revalidate();
      if (checked?.ok && Number(checked.percent) > 0) {
        canonicalPromoCode = checked.code || requestedPromo;
        canonicalDiscountPercent = Number(checked.percent);
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

      loadingId = toast.loading("Bikin ID order...");
      let createdOrder = null;
      let generatedCode = "";

      for (let index = 0; index < 5; index += 1) {
        generatedCode = makeOrderCode(8);
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
      // Save buyer name from WA number prefix for greeting
      if (customerWhatsApp) {
        try {
          const waLabel = localStorage.getItem("imzaqi_last_whatsapp_name") || "";
          if (!waLabel) saveBuyerName(customerWhatsApp.replace(/^62/, "0"));
        } catch {}
      }
      addOrderToHistory({
        order_code: generatedCode,
        created_at: new Date().toISOString(),
        total_idr: canonicalOrder.total,
        status: createdOrder.status || (hasPricingMismatch ? "paid_reported" : "pending"),
      });
      const loyaltyResult = recordCompletedOrder();
      if (loyaltyResult.unlocked) {
        toast.success(`Promo ${LOYALTY_PROMO_CODE} terbuka! Pakai di checkout berikutnya.`, { duration: 5000 });
      }
      if (loadingId) toast.remove(loadingId);
      toast.success("ID order berhasil dibuat.");
    } catch (error) {
      const message = toFriendlyPayError(error, { hasNotes: Boolean(noteText) });
      warn("Gagal memproses order:", error);
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

  const canSubmit = !busy && (isFreeOrder ? hasValidWhatsApp && !missingBuyerEmailNote : canShowQris);

  const payCtaHint = !hasValidWhatsApp
    ? "Isi WhatsApp dulu"
    : missingBuyerEmailNote
      ? "Lengkapi email buyer"
      : null;

  function focusBlockingField() {
    if (!hasValidWhatsApp) {
      contactCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (focusTimerRef.current) window.clearTimeout(focusTimerRef.current);
      focusTimerRef.current = window.setTimeout(() => {
        document.getElementById("whatsapp-input")?.focus({ preventScroll: true });
      }, 280);
      return;
    }

    if (missingBuyerEmailNote) {
      buyerEmailRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (focusTimerRef.current) window.clearTimeout(focusTimerRef.current);
      focusTimerRef.current = window.setTimeout(() => {
        buyerEmailRef.current?.focus({ preventScroll: true });
      }, 280);
    }
  }

  function handlePayCtaClick() {
    if (canSubmit) {
      setShowConfirmModal(true);
      return;
    }
    focusBlockingField();
  }

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

  function renderPayConfirmButton(extraClass = "") {
    const klass = `btn btn-wide pay-confirmBtn${!canSubmit ? " is-locked" : ""}${extraClass ? ` ${extraClass}` : ""}`.trim();

    return (
      <button
        className={klass}
        disabled={busy}
        onClick={handlePayCtaClick}
        type="button"
        aria-disabled={!canSubmit || undefined}
      >
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
    );
  }

  function renderStageActions(extraClass = "") {
    const klass = `pay-stageActions ${extraClass}`.trim();

    return <div className={klass}>{renderPayConfirmButton()}</div>;
  }

  return (
    <div className="page pay-shell pay-page">
      <section className="section reveal pay-shell-hero">
        <div className="container pay-shell-top">
          <div className="pay-shell-copy hero-anim-wrap">
            <p className="pay-shell-kicker">QRIS</p>
            <h1 className="h1 pay-shell-title hero-anim-title">Bayar</h1>
          </div>
        </div>

        <div className="container pay-shell-steps">
          <CheckoutSteps current="pay" />
        </div>

        {items.length > 0 ? (
          <div className="container pay-order-mobileWrap">
            <aside className="card pad pay-card pay-orderMobileCard reveal">
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
            <section ref={contactCardRef} className="card pad pay-card pay-contactCard reveal" style={{ transitionDelay: "90ms" }}>
              <div className="pay-cardHead">
                <div>
                  <div className="pay-cardKicker">Kontak order</div>
                  <h2 className="h3 pay-cardTitle">WhatsApp</h2>
                </div>
                <span className={`pay-statePill ${isFreeOrder ? "free" : canShowQris ? "live" : "locked"}`}>
                  {isFreeOrder ? "Gratis" : canShowQris ? "Siap" : "Terkunci"}
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
                helperText="Nomor buat notifikasi order ini ya."
                placeholder="08xxxxxxxxxx"
                className="pay-waField"
              />

              {requiresBuyerEmailNote && (
                <div className="pay-emailPanel required">
                  <div className="pay-emailHead">
                    <div className="pay-emailLabelWrap">
                      <Mail size={14} aria-hidden="true" />
                      <label className="pay-emailLabel" htmlFor="pay-buyer-email">
                        Email pembeli
                      </label>
                    </div>
                    <span className={`pay-emailState ${missingBuyerEmailNote ? "warn" : "ok"}`}>
                      {missingBuyerEmailNote ? "Wajib diisi" : "Terisi"}
                    </span>
                  </div>

                  <input
                    ref={buyerEmailRef}
                    id="pay-buyer-email"
                    type="email"
                    className="input pay-emailInput"
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    placeholder="pembeli@email.com"
                    aria-invalid={missingBuyerEmailNote || undefined}
                    aria-describedby="pay-email-hint"
                    autoComplete="email"
                    inputMode="email"
                  />

                  <div id="pay-email-hint" className="pay-emailHintText">
                    {missingBuyerEmailNote
                      ? `${requiredEmailProductsText} butuh email pembeli buat aktivasi akun.`
                      : "Email pembeli sudah terisi - akun bakal dikirim ke sini."}
                  </div>
                </div>
              )}

              <div className="pay-notePanel">
                <div className="pay-noteHead">
                  <div className="pay-noteLabelWrap">
                    <FileText size={14} aria-hidden="true" />
                    <label className="pay-noteLabel" htmlFor="pay-notes">
                      Catatan tambahan
                    </label>
                  </div>
                  <span className="pay-noteState">Opsional</span>
                </div>

                <textarea
                  id="pay-notes"
                  className="input pay-noteInput"
                  rows={2}
                  maxLength={400}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: minta diproses malam ini."
                />

                <div className="pay-noteMetaRow">
                  <div className="pay-noteHintText">
                    Ada request khusus? Tulis di sini, admin bakal baca.
                  </div>
                  <div className="pay-noteMeta">{notes.length}/400</div>
                </div>
              </div>
            </section>

            <section className="card pad pay-card pay-stageCard reveal" style={{ transitionDelay: "160ms" }}>
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

                  {payCtaHint ? <div className="pay-stageMobileHint">{payCtaHint}</div> : null}

                  {showPayCta ? renderStageActions("pay-stageActionsMobile") : null}
                  {renderStageActions("pay-stageActionsDesktop")}
                </div>

                <div className="pay-stageVisual">
                  <div
                    className={`qris-wrap pay-qrisFrame ${canShowQris && !isFreeOrder ? "" : "is-locked"}${qrisJustUnlocked ? " is-unlocking" : ""}`}
                  >
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
                      <div className="pay-qrisBox">
                        {/* QRIS timer - tampil paling atas di atas kartu QR */}
                        {qris.loaded && !qris.failed && !qrisTimer.expired && (
                          <div className={`pay-qrisTimer${qrisTimer.urgent ? " is-urgent" : ""}`} aria-live="polite">
                            <Clock size={13} />
                            <span>QR valid: <strong>{qrisTimer.label}</strong></span>
                          </div>
                        )}
                        {qrisTimer.expired && (
                          <div className="pay-qrisTimer is-expired" role="alert">
                            <Clock size={13} />
                            <span>QR kedaluwarsa - refresh halaman untuk QR baru</span>
                          </div>
                        )}

                        {!qris.loaded && !qris.failed ? <QRISSkeleton /> : null}
                        {qris.url ? (
                          <button
                            type="button"
                            className="pay-qrisZoomBtn"
                            aria-label="Perbesar QRIS pembayaran"
                            onClick={() => setIsZoomed(true)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setIsZoomed(true);
                              }
                            }}
                            style={{ display: qris.loaded && !qris.failed ? "block" : "none" }}
                          >
                            <img
                              src={qris.url}
                              alt=""
                              className="qris-img"
                              onLoad={() => dispatchQris({ type: "LOADED" })}
                              onError={(event) => {
                                event.target.style.display = "none";
                                dispatchQris({ type: "FAILED" });
                              }}
                            />
                          </button>
                        ) : null}

                        {qris.loaded && !qris.failed && qris.url && (
                          <a
                            href={qris.url}
                            download="qris-pembayaran.png"
                            className="btn btn-ghost btn-sm pay-qrisDownload"
                          >
                            Simpan QRIS ke Galeri
                          </a>
                        )}

                        {qris.failed ? <div className="hint subtle">QRIS gagal dimuat. Refresh lalu coba lagi.</div> : null}
                      </div>
                    ) : (
                      <div className="pay-qrisLocked">
                        <Phone size={24} />
                        <strong>{qrisLockTitle}</strong>
                        <p>{qrisLockDescription}</p>
                      </div>
                    )}
                  </div>

                  <div className={`pay-stageFoot ${canShowQris && !isDynamicQris && !isFreeOrder ? "warning" : ""}`}>
                    {isFreeOrder ? "Promo 100% aktif - tidak ada pembayaran yang diperlukan." : qrisFootText}
                  </div>
                  {canShowQris && qris.notice && !isFreeOrder ? (
                    <div className={`hint subtle pay-stageNotice ${!isDynamicQris ? "is-warning" : ""}`}>{qris.notice}</div>
                  ) : null}
                </div>
              </div>
            </section>
          </div>

          {items.length > 0 ? (
            <aside className="card pad pay-card pay-orderDesktop reveal" style={{ transitionDelay: "120ms" }}>
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
        isAcademicOrder={isAcademicOrder}
        onClose={() => nav(statusUrl)}
        onCopied={() => toast.success("ID order disalin")}
      />

      <QRISZoomModal
        open={isZoomed}
        qrisUrl={qris.url}
        onClose={() => setIsZoomed(false)}
      />

    </div>
  );
}
