import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowLeft, ShoppingBag, TicketPercent, X, Trash2 } from "lucide-react";
import { useCart } from "../context/CartContext";
import { usePromo } from "../hooks/usePromo";
import { formatIDR } from "../lib/format";
import { checkStockAvailability } from "../lib/api";
import CheckoutSteps from "../components/CheckoutSteps";
import CheckoutExtrasPanel from "../components/CheckoutExtrasPanel";
import "../css/pages/Checkout.css";
import "../css/checkout-steps.css";

import { markCheckoutVisited } from "../lib/cartReminder";
import EmptyState from "../components/EmptyState";
import { useToast } from "../context/ToastContext";
import { usePageMeta } from "../hooks/usePageMeta";
import { useAdaptiveMotion } from "../hooks/useAdaptiveMotion";
import { useDialogA11y } from "../hooks/useDialogA11y";

function calcTotal(subtotal, percent) {
  const discount = Math.round((subtotal * (percent || 0)) / 100);
  return { discount, total: Math.max(0, subtotal - discount) };
}

/* ── Desktop-only framer-motion variants ── */
const backdropVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } },
};
const backdropVariantsLite = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, transition: { duration: 0.14, ease: [0.22, 1, 0.36, 1] } },
};
const desktopDrawerVariants = {
  hidden:  { x: "100%", opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { type: "spring", damping: 30, stiffness: 300, mass: 0.82 } },
  exit:    { x: "100%", opacity: 0, transition: { type: "spring", damping: 30, stiffness: 300, mass: 0.82 } },
};
const desktopDrawerVariantsLite = {
  hidden:  { x: "100%" },
  visible: { x: 0, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] } },
  exit:    { x: "100%", transition: { duration: 0.16, ease: [0.22, 1, 0.36, 1] } },
};

export default function Checkout() {
  const nav = useNavigate();
  const location = useLocation();
  const cart = useCart();
  const { promo, apply, clear } = usePromo();
  const toast = useToast();
  const closeButtonRef = useRef(null);
  const drawerRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const motionMode = useAdaptiveMotion();
  const isMotionOff = motionMode === "off" || reduceMotion;
  const isLiteMotion = motionMode === "lite" && !isMotionOff;

  const promoPercent = Number(promo?.percent || 0);
  const subtotal = cart.subtotal();
  const { discount, total } = calcTotal(subtotal, promoPercent);

  const [code, setCode] = useState(() => promo?.code || "");
  const [isVerifying, setIsVerifying] = useState(false);
  const [msg, setMsg] = useState("");
  const [closing, setClosing] = useState(false);
  const [stockWarnings, setStockWarnings] = useState({});
  const [isMobileSheet, setIsMobileSheet] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 720px)").matches : false
  );
  // CSS-class-based phase for mobile (no framer-motion on mobile)
  const [mobilePhase, setMobilePhase] = useState("entering"); // entering | open | closing
  const mobileOpenFrameRef = useRef(null);

  const drawerBodyRef = useRef(null);
  const [promoStatus, setPromoStatus] = useState(null); // 'success' | 'error' | null

  usePageMeta({
    title: "Checkout",
    description: "Cek order & total dulu sebelum bayar - biar gak salah.",
  });

  useEffect(() => {
    const next = promo?.code || "";
    setCode((prev) => (prev ? prev : next));
  }, [promo]);

  useEffect(() => {
    if (cart.items.length === 0) return;
    let active = true;
    const timer = setTimeout(() => {
      checkStockAvailability(cart.items).then((result) => {
        if (!active) return;
        const warnings = {};
        result.outOfStock.forEach((item) => {
          warnings[item.variant_id] = { type: "out", available: 0 };
        });
        result.insufficient.forEach((item) => {
          warnings[item.variant_id] = { type: "insufficient", available: item.availableStock };
        });
        setStockWarnings(warnings);
      }).catch(() => {});
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [cart.items]);

  useEffect(() => {
    document.body.classList.add("checkout-open");
    markCheckoutVisited();
    return () => document.body.classList.remove("checkout-open");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const media = window.matchMedia("(max-width: 720px)");
    const sync = (event) => setIsMobileSheet(event.matches);
    setIsMobileSheet(media.matches);

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", sync);
      return () => media.removeEventListener("change", sync);
    }

    media.addListener(sync);
    return () => media.removeListener(sync);
  }, []);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  // Mobile CSS-phase: mount → next frame → "open" (triggers CSS transition)
  useEffect(() => {
    if (!isMobileSheet) return undefined;
    mobileOpenFrameRef.current = window.requestAnimationFrame(() => {
      mobileOpenFrameRef.current = window.requestAnimationFrame(() => {
        setMobilePhase("open");
      });
    });
    return () => {
      if (mobileOpenFrameRef.current) window.cancelAnimationFrame(mobileOpenFrameRef.current);
    };
  }, [isMobileSheet]);

  // When closing on mobile, set phase to "closing" first, then navigate
  useEffect(() => {
    if (!closing || !isMobileSheet) return undefined;
    setMobilePhase("closing");
    return undefined;
  }, [closing, isMobileSheet]);

  const itemCount = useMemo(() => cart.items.reduce((sum, item) => sum + Number(item.qty || 0), 0), [cart.items]);
  const hasStockIssue = useMemo(() => cart.items.some((item) => stockWarnings[item.variant_id]), [cart.items, stockWarnings]);
  const stockDisabledReason = hasStockIssue ? "Ada item yang stoknya abis atau kurang" : null;
  const backgroundLocation = location.state?.backgroundLocation;
  const isDrawerCheckout = Boolean(backgroundLocation);

  const requestClose = useCallback(() => {
    setClosing((prev) => (prev ? prev : true));
  }, []);

  useDialogA11y({
    open: true,
    containerRef: drawerRef,
    onClose: requestClose,
    initialFocusSelector: ".checkout-drawerClose",
  });

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape" && event.target.tagName !== "INPUT" && event.target.tagName !== "TEXTAREA") {
        requestClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [requestClose]);

  useEffect(() => {
    if (!closing) return undefined;

    const timer = window.setTimeout(() => {
      if (backgroundLocation || (typeof window !== "undefined" && window.history.length > 1)) {
        nav(-1);
        return;
      }

      nav("/", { replace: true });
    }, isMotionOff ? 100 : isMobileSheet ? 400 : (isLiteMotion ? 190 : 280));

    return () => window.clearTimeout(timer);
  }, [backgroundLocation, closing, isLiteMotion, isMotionOff, isMobileSheet, nav]);

  async function onApplyPromo() {
    const raw = String(code || "").trim();
    if (!raw) {
      const text = "Isi kode promonya dulu.";
      setMsg(text);
      toast.error(text);
      setPromoStatus("error");
      const t = setTimeout(() => setPromoStatus(null), 1500);
      // eslint-disable-next-line no-underscore-dangle
      onApplyPromo._lastTimer = t;
      return;
    }

    setMsg("");
    setIsVerifying(true);
    try {
      const result = await apply(raw);
      setMsg(result.message);
      if (result.ok) {
        toast.success(result.message);
        setPromoStatus("success");
      } else {
        toast.error(result.message);
        setPromoStatus("error");
      }
    } catch (e) {
      toast.error("Gagal cek kode promo. Coba lagi ya.");
    } finally {
      setIsVerifying(false);
      const t = setTimeout(() => setPromoStatus(null), 1500);
      // eslint-disable-next-line no-underscore-dangle
      onApplyPromo._lastTimer = t;
    }
  }



  function goPay() {
    if (cart.items.length === 0) {
      const text = "Keranjang masih kosong.";
      setMsg(text);
      toast.error(text);
      return;
    }

    if (hasStockIssue) {
      const text = "Ada item yang stoknya abis atau gak cukup. Hapus atau kurangi qty dulu.";
      setMsg(text);
      toast.error(text);
      return;
    }

    nav("/bayar");
  }

  function renderPromoCard() {
    return (
      <div className="checkout-promo-card">
        <div className="checkout-promo-head">
          <div className="checkout-promo-title">
            <TicketPercent size={15} />
            <span>Kode promo</span>
          </div>
          {promoPercent ? (
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() => {
                clear();
                setCode("");
                setMsg("");
                toast.info("Promo di-reset.");
              }}
            >
              Reset
            </button>
          ) : null}
        </div>

        <div className={`checkout-promo-controls ${promoStatus ? `promo-${promoStatus}` : ""}`}>
          <label htmlFor="checkout-promo-code" className="sr-only">
            Kode promo
          </label>
          <input
            id="checkout-promo-code"
            className="input"
            placeholder="Kode promo"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            disabled={isVerifying}
            aria-describedby={msg ? "checkout-promo-message" : undefined}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (!isVerifying) onApplyPromo();
              }
            }}
          />
          <button className="btn btn-sm" type="button" onClick={onApplyPromo} disabled={isVerifying}>
            {isVerifying ? "..." : "Pakai"}
          </button>
        </div>

        {msg ? (
          <div
            id="checkout-promo-message"
            className={`checkout-promo-message ${promoPercent ? "ok" : ""}`}
            aria-live="polite"
            role="status"
          >
            {msg}
          </div>
        ) : null}
      </div>
    );
  }

  function renderSummary(extraClass = "") {
    return (
      <aside className={`card pad checkout-panel checkout-summary ${extraClass}`}>
        <div className="checkout-summaryBadge">{total === 0 && subtotal > 0 ? "🎉 GRATIS" : discount > 0 ? `${promoPercent}% off` : "Ringkasan"}</div>
        <div className="checkout-summaryLabel">Total saat ini</div>
        <div className="checkout-summaryTotal">{formatIDR(total)}</div>

        <div className="checkout-summaryRows">
          <div className="checkout-summaryRow">
            <span>Subtotal</span>
            <b>{formatIDR(subtotal)}</b>
          </div>
          {discount > 0 ? (
            <div className="checkout-summaryRow">
              <span>Promo</span>
              <b>- {formatIDR(discount)}</b>
            </div>
          ) : null}
        </div>

        <button className="btn btn-wide checkout-summaryBtn" type="button" onClick={goPay} disabled={cart.items.length === 0 || hasStockIssue}>
          Lanjut ke bayar
          <ArrowRight size={16} />
        </button>

        <Link className="checkout-summaryLink" to="/status">
          Udah punya ID? Cek status
        </Link>
      </aside>
    );
  }

  // Shared drawer body content used by both mobile and desktop paths
  function renderDrawerContent() {
    return (
      <>
        <div className="checkout-drawerHandle" aria-hidden="true" />

        <div className="checkout-drawerHead">
          <div className="checkout-drawerCopy">
            <h1 className="h1 checkout-drawerTitle">Checkout.</h1>
            <p className="checkout-drawerSub">Cek order dulu sebelum bayar.</p>
          </div>

          <button
            ref={closeButtonRef}
            className="checkout-drawerClose"
            type="button"
            onClick={requestClose}
            aria-label="Tutup checkout"
          >
            <X size={18} strokeWidth={2.2} />
          </button>
        </div>

        <div ref={drawerBodyRef} className="checkout-drawerBody">
          <div className="checkout-drawerSteps">
            <CheckoutSteps current="checkout" />
          </div>

          {cart.items.length > 0 && !isMobileSheet ? (
            <div className="checkout-summary-mobileWrap">{renderSummary("checkout-summary-mobile")}</div>
          ) : null}

          <div className="checkout-drawerGrid">
            <section className="card pad checkout-panel checkout-main">
              <div className="checkout-main-head">
                <div>
                  <div className="checkout-main-kicker">Keranjang</div>
                  <h2 className="h3 checkout-main-title">
                    {cart.items.length === 0 ? "Belum ada pilihan" : "Isi order"}
                  </h2>
                </div>
                {cart.items.length > 0 ? <span className="checkout-main-count">x{itemCount}</span> : null}
              </div>

              {cart.items.length === 0 ? (
                <EmptyState
                  icon={<ShoppingBag size={30} strokeWidth={2.2} />}
                  title="Keranjang kosong"
                  description="Gas dari katalog, tambah paket yang cocok."
                  primaryAction={{ label: "Produk", to: "/produk" }}
                  secondaryAction={{ label: "Status", to: "/status" }}
                />
              ) : (
                <>
                  <div className="checkout-item-list">
                    {cart.items.map((item) => (
                      <CheckoutItemCard
                        key={item.variant_id}
                        item={item}
                        cart={cart}
                        toast={toast}
                        stockWarnings={stockWarnings}
                      />
                    ))}
                  </div>

                  <CheckoutExtrasPanel
                    collapsed={isMobileSheet}
                    promoSection={renderPromoCard()}
                  />
                </>
              )}
            </section>

            {cart.items.length > 0 ? renderSummary("checkout-summary-desktop") : null}
          </div>
        </div>

        {cart.items.length > 0 && isMobileSheet ? (
          <div className="checkout-mobile-floating-bar checkout-mobile-floating-bar--drawer">
            <div className="checkout-floating-bar-info">
              <span className="checkout-floating-bar-label">Total</span>
              <span className="checkout-floating-bar-price">{formatIDR(total)}</span>
              {stockDisabledReason ? (
                <span className="checkout-floating-bar-reason" role="status">
                  {stockDisabledReason}
                </span>
              ) : null}
            </div>
            <button
              className="btn btn-primary checkout-floating-bar-btn"
              type="button"
              onClick={goPay}
              disabled={hasStockIssue}
              aria-describedby={stockDisabledReason ? "checkout-drawer-stock-reason" : undefined}
            >
              <span>Lanjut ke bayar</span>
              <ArrowRight size={16} />
            </button>
            {stockDisabledReason ? (
              <span id="checkout-drawer-stock-reason" className="sr-only">
                {stockDisabledReason}
              </span>
            ) : null}
          </div>
        ) : null}
      </>
    );
  }

  if (typeof document === "undefined") return null;

  if (!isDrawerCheckout) {
    // ── FULL-PAGE MODE (mobile + direct visits; desktop without overlay state) ──
    return (
      <div className="page checkout-page-full">
        <div className="container checkout-full-container">
          <div className="checkout-full-header">
            <button
              onClick={() => {
                if (window.history.length > 1) {
                  nav(-1);
                } else {
                  nav("/");
                }
              }}
              className="btn btn-ghost checkout-back-btn"
              type="button"
            >
              <ArrowLeft size={16} />
              <span>Kembali</span>
            </button>
            <div className="checkout-full-title-wrap hero-anim-wrap">
              <h1 className="h1 checkout-full-title hero-anim-title">Checkout</h1>
              <p className="checkout-full-sub hero-anim-sub">Cek order dulu sebelum bayar.</p>
            </div>
          </div>

          <div className="checkout-full-steps">
            <CheckoutSteps current="checkout" />
          </div>

          <div className="checkout-full-grid">
            <main className="checkout-full-main">
              {cart.items.length === 0 ? (
                <div className="card pad checkout-panel checkout-full-empty-card">
                  <EmptyState
                    icon={<ShoppingBag size={30} strokeWidth={2.2} />}
                    title="Keranjang kosong"
                    description="Gas dari katalog, tambah paket yang cocok."
                    primaryAction={{ label: "Produk", to: "/produk" }}
                    secondaryAction={{ label: "Status", to: "/status" }}
                  />
                </div>
              ) : (
                <div className="checkout-full-left-cards">
                  <section className="card pad checkout-panel checkout-full-items-panel">
                    <div className="checkout-main-head">
                      <div>
                        <div className="checkout-main-kicker">Keranjang</div>
                        <h2 className="h3 checkout-main-title">Isi Order</h2>
                      </div>
                      <span className="checkout-main-count">x{itemCount}</span>
                    </div>

                    <div className="checkout-item-list">
                      {cart.items.map((item) => (
                        <CheckoutItemCard
                          key={item.variant_id}
                          item={item}
                          cart={cart}
                          toast={toast}
                          stockWarnings={stockWarnings}
                        />
                      ))}
                    </div>
                  </section>

                  <section className="card pad checkout-panel checkout-full-promo-panel">
                    <CheckoutExtrasPanel
                      collapsed={isMobileSheet}
                      promoSection={renderPromoCard()}
                    />
                  </section>
                </div>
              )}
            </main>

            {cart.items.length > 0 && (
              <aside className="checkout-full-side">
                {renderSummary("checkout-summary-full")}
              </aside>
            )}
          </div>
        </div>

        {/* Mobile sticky floating bottom bar */}
        {cart.items.length > 0 && (
          <div className="checkout-mobile-floating-bar">
            <div className="checkout-floating-bar-info">
              <span className="checkout-floating-bar-label">Total Pembayaran</span>
              <span className="checkout-floating-bar-price">{formatIDR(total)}</span>
              {stockDisabledReason ? (
                <span className="checkout-floating-bar-reason" role="status">
                  {stockDisabledReason}
                </span>
              ) : null}
            </div>
            <button
              className="btn btn-primary checkout-floating-bar-btn"
              onClick={goPay}
              disabled={hasStockIssue}
              aria-describedby={stockDisabledReason ? "checkout-full-stock-reason" : undefined}
            >
              <span>Lanjut ke bayar</span>
              <ArrowRight size={16} />
            </button>
            {stockDisabledReason ? (
              <span id="checkout-full-stock-reason" className="sr-only">
                {stockDisabledReason}
              </span>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  // ── MOBILE PORTAL: pure CSS class-swap (no framer-motion = no JS animation overhead) ──
  if (isMobileSheet) {
    const phaseClass = `checkout-mobile-${mobilePhase}`;
    return createPortal(
      <div className="checkout-overlay" role="presentation">
        <div
          className={`checkout-backdrop checkout-backdrop-mobile ${phaseClass}`}
          onMouseDown={requestClose}
          aria-hidden="true"
        />
        <div
          ref={drawerRef}
          className={`checkout-drawer ${phaseClass}`}
          role="dialog"
          aria-modal="true"
          aria-label="Checkout"
        >
          {renderDrawerContent()}
        </div>
      </div>,
      document.body
    );
  }

  // ── DESKTOP PORTAL: framer-motion (smooth on desktop GPU) ──
  const drawerVariants = isLiteMotion ? desktopDrawerVariantsLite : desktopDrawerVariants;
  const overlayVariants = isLiteMotion ? backdropVariantsLite : backdropVariants;

  return createPortal(
    <div className="checkout-overlay" role="presentation">
      <motion.div
        className="checkout-backdrop"
        variants={overlayVariants}
        initial="hidden"
        animate={closing ? "exit" : "visible"}
        onMouseDown={requestClose}
        aria-hidden="true"
      />

      <motion.div
        ref={drawerRef}
        className="checkout-drawer"
        variants={drawerVariants}
        initial="hidden"
        animate={closing ? "exit" : "visible"}
        onMouseDown={(event) => event.stopPropagation()}
        style={{ willChange: "transform" }}
        role="dialog"
        aria-modal="true"
        aria-label="Checkout"
      >
        {renderDrawerContent()}
      </motion.div>
    </div>,
    document.body
  );
}

function CheckoutItemCard({ item, cart, toast, stockWarnings }) {
  const [pulseKind, setPulseKind] = useState(null);
  const pulseTimerRef = useRef(null);
  const removeTimerRef = useRef(null);

  useEffect(
    () => () => {
      if (pulseTimerRef.current) window.clearTimeout(pulseTimerRef.current);
      if (removeTimerRef.current) window.clearTimeout(removeTimerRef.current);
    },
    []
  );

  const triggerQtyPulse = useCallback(() => {
    setPulseKind("qty");
    if (pulseTimerRef.current) window.clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = window.setTimeout(() => setPulseKind(null), 380);
  }, []);

  const handleRemove = () => {
    if (pulseKind === "remove") return;
    setPulseKind("remove");
    if (removeTimerRef.current) window.clearTimeout(removeTimerRef.current);
    removeTimerRef.current = window.setTimeout(() => {
      cart.remove(item.variant_id);
      setPulseKind(null);
      toast.info(`${item.product_name} dihapus`, {
        title: "Keranjang",
        actionLabel: "Batalin",
        duration: 6000,
        onAction: () =>
          cart.add(
            {
              id: item.variant_id,
              product_id: item.product_id,
              product_name: item.product_name,
              product_icon_url: item.product_icon_url || "",
              name: item.variant_name,
              duration_label: item.duration_label,
              price_idr: item.price_idr,
              description: item.description || "",
              guarantee_text: item.guarantee_text || "",
              requires_buyer_email: !!item.requires_buyer_email,
            },
            item.qty
          ),
      });
    }, 220);
  };

  const iconUrl = String(item?.product_icon_url || "").trim();

  return (
    <div
      className={`checkout-item-card${pulseKind === "qty" ? " is-qty-pulse" : ""}${pulseKind === "remove" ? " is-removing" : ""}`}
    >
      <div className="checkout-item-left">
        <div className="checkout-item-icon app-productIcon">
          {iconUrl ? (
            <img src={iconUrl} alt={`${item.product_name} icon`} loading="lazy" decoding="async" />
          ) : (
            <span className="app-productIconFallback">
              {String(item.product_name || "P").slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <div className="checkout-item-copy">
          <div className="checkout-item-name">{item.product_name}</div>
          <div className="checkout-item-meta">
            {item.variant_name} / {item.duration_label}
          </div>
        </div>
      </div>

      <div className="checkout-item-controls">
        <div className="checkout-item-stepper">
          <button
            className="qty-btn"
            onClick={() => {
              cart.setQty(item.variant_id, item.qty - 1);
              triggerQtyPulse();
            }}
            aria-label={`Kurangi jumlah ${item.product_name}`}
            disabled={item.qty <= 1}
          >
            -
          </button>
          <input
            className={`qty${item.qty < 1 || item.qty > 99 ? " qty--invalid" : ""}`}
            type="number"
            min="1"
            max="99"
            value={item.qty}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (Number.isFinite(val) && val >= 1 && val <= 99) {
                cart.setQty(item.variant_id, val);
                triggerQtyPulse();
              } else if (e.target.value === "") {
                cart.setQty(item.variant_id, 1);
                triggerQtyPulse();
              }
            }}
            aria-label={`Jumlah ${item.product_name}`}
            aria-invalid={item.qty < 1 || item.qty > 99}
          />
          <button
            className="qty-btn"
            onClick={() => {
              cart.setQty(item.variant_id, item.qty + 1);
              triggerQtyPulse();
            }}
            aria-label={`Tambah jumlah ${item.product_name}`}
            disabled={item.qty >= 99}
          >
            +
          </button>
        </div>

        <div className="checkout-item-price">{formatIDR(item.price_idr * item.qty)}</div>

        <button
          className="checkout-item-remove"
          type="button"
          onClick={handleRemove}
          aria-label="Hapus item"
        >
          <Trash2 size={13} />
          <span>Hapus</span>
        </button>
      </div>
      {stockWarnings[item.variant_id] ? (
        <div
          role="alert"
          className={`checkout-stockWarn ${stockWarnings[item.variant_id].type}`}
        >
          <span className="checkout-stockWarn-text">
            {stockWarnings[item.variant_id].type === "out"
              ? "Stok abis nih - hapus dulu biar lanjut"
              : `Stok cuma ${stockWarnings[item.variant_id].available}, kamu pesan ${item.qty}`}
          </span>
          <div className="checkout-stockWarn-actions">
            {stockWarnings[item.variant_id].type === "insufficient" ? (
              <button
                type="button"
                className="btn btn-sm btn-ghost checkout-stockWarn-btn"
                onClick={() => {
                  cart.setQty(item.variant_id, stockWarnings[item.variant_id].available);
                  triggerQtyPulse();
                  toast.info(`Jumlah ${item.product_name} disesuaikan ke stok yang ada`);
                }}
              >
                Kurangi ke {stockWarnings[item.variant_id].available}
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-sm btn-ghost checkout-stockWarn-btn"
              onClick={handleRemove}
            >
              Hapus item
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
