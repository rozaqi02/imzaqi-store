import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ShoppingBag, Sparkles, TicketPercent, X } from "lucide-react";
import { useCart } from "../context/CartContext";
import { usePromo } from "../hooks/usePromo";
import { formatIDR } from "../lib/format";
import { checkStockAvailability } from "../lib/api";
import CheckoutSteps from "../components/CheckoutSteps";
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
  const [msg, setMsg] = useState("");
  const [closing, setClosing] = useState(false);
  const [stockWarnings, setStockWarnings] = useState({});
  const [isMobileSheet, setIsMobileSheet] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 720px)").matches : false
  );
  // CSS-class-based phase for mobile (no framer-motion on mobile)
  const [mobilePhase, setMobilePhase] = useState("entering"); // entering | open | closing
  const mobileOpenFrameRef = useRef(null);

  usePageMeta({
    title: "Checkout",
    description: "Review order, promo, dan total sebelum lanjut ke halaman pembayaran.",
  });

  useEffect(() => {
    const next = promo?.code || "";
    setCode((prev) => (prev ? prev : next));
  }, [promo]);

  useEffect(() => {
    if (cart.items.length === 0) return;
    let active = true;
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
    return () => { active = false; };
  }, [cart.items]);

  useEffect(() => {
    document.body.classList.add("checkout-open");
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
  const backgroundLocation = location.state?.backgroundLocation;

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
      if (event.key === "Escape") requestClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [requestClose]);

  useEffect(() => {
    if (!closing) return undefined;

    const timer = window.setTimeout(() => {
      if (backgroundLocation) {
        nav(-1);
        return;
      }

      nav("/", { replace: true });
    }, isMotionOff ? 100 : isMobileSheet ? 280 : (isLiteMotion ? 190 : 280));

    return () => window.clearTimeout(timer);
  }, [backgroundLocation, closing, isLiteMotion, isMotionOff, isMobileSheet, nav]);

  async function onApplyPromo() {
    const raw = String(code || "").trim();
    if (!raw) {
      const text = "Kode promo kosong.";
      setMsg(text);
      toast.error(text);
      return;
    }

    setMsg("");
    const result = await apply(raw);
    setMsg(result.message);
    if (result.ok) toast.success(result.message);
    else toast.error(result.message);
  }

  function goPay() {
    if (cart.items.length === 0) {
      const text = "Keranjang masih kosong.";
      setMsg(text);
      toast.error(text);
      return;
    }

    nav("/bayar");
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

        <button className="btn btn-wide checkout-summaryBtn" type="button" onClick={goPay} disabled={cart.items.length === 0}>
          Lanjut ke bayar
          <ArrowRight size={16} />
        </button>

        <Link className="checkout-summaryLink" to="/status">
          Sudah pegang ID? Buka status
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
            <div className="checkout-drawerKicker">
              <Sparkles size={14} />
              <span>Checkout</span>
            </div>
            <h1 className="h1 checkout-drawerTitle">Checkout.</h1>
            <p className="checkout-drawerSub">Cek ulang isi order, promo, dan total sebelum masuk ke pembayaran.</p>
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

        <div className="checkout-drawerBody">
          <div className="checkout-drawerSteps">
            <CheckoutSteps current="checkout" />
          </div>

          {cart.items.length > 0 ? (
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
                  description="Mulai dari katalog, lalu tambahkan paket yang sudah cocok."
                  primaryAction={{ label: "Produk", to: "/produk" }}
                  secondaryAction={{ label: "Status", to: "/status" }}
                />
              ) : (
                <>
                  <div className="checkout-item-list">
                    {cart.items.map((item) => {
                      const iconUrl = String(item?.product_icon_url || "").trim();
                      return (
                        <div key={item.variant_id} className="checkout-item-card">
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
                                onClick={() => cart.setQty(item.variant_id, item.qty - 1)}
                                aria-label="Kurangi"
                              >
                                -
                              </button>
                              <input
                                className="qty"
                                type="number"
                                min="1"
                                max="99"
                                value={item.qty}
                                onChange={(e) => cart.setQty(item.variant_id, Number(e.target.value))}
                              />
                              <button
                                className="qty-btn"
                                onClick={() => cart.setQty(item.variant_id, item.qty + 1)}
                                aria-label="Tambah"
                              >
                                +
                              </button>
                            </div>

                            <div className="checkout-item-price">{formatIDR(item.price_idr * item.qty)}</div>

                            <button
                              className="checkout-item-remove"
                              type="button"
                              onClick={() => {
                                cart.remove(item.variant_id);
                                toast.info(`${item.product_name} dihapus`, {
                                  title: "Keranjang",
                                  actionLabel: "Undo",
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
                              }}
                            >
                              Hapus
                            </button>
                          </div>
                          {stockWarnings[item.variant_id] ? (
                            <div className={`checkout-stockWarn ${stockWarnings[item.variant_id].type}`}>
                              {stockWarnings[item.variant_id].type === "out"
                                ? "⚠ Stok habis — pertimbangkan untuk menghapus item ini"
                                : `⚠ Stok tersisa ${stockWarnings[item.variant_id].available}, kamu pesan ${item.qty}`}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

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
                            setMsg("");
                            toast.info("Promo direset.");
                          }}
                        >
                          Reset
                        </button>
                      ) : null}
                    </div>

                    <div className="checkout-promo-controls">
                      <input
                        className="input"
                        placeholder="Kode promo"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                      />
                      <button className="btn btn-sm" type="button" onClick={onApplyPromo}>
                        Pakai
                      </button>
                    </div>

                    {msg ? (
                      <div className={`checkout-promo-message ${promoPercent ? "ok" : ""}`}>{msg}</div>
                    ) : null}
                  </div>
                </>
              )}
            </section>

            {cart.items.length > 0 ? renderSummary("checkout-summary-desktop") : null}
          </div>
        </div>
      </>
    );
  }

  if (typeof document === "undefined") return null;

  // ── MOBILE: pure CSS class-swap (no framer-motion = no JS animation overhead) ──
  if (isMobileSheet) {
    const phaseClass = `checkout-mobile-${mobilePhase}`;
    return createPortal(
      <div className="checkout-overlay" role="presentation">
        <div
          className={`checkout-backdrop checkout-backdrop-mobile ${phaseClass}`}
          onMouseDown={requestClose}
          aria-hidden="true"
        />
        <aside
          ref={drawerRef}
          className={`checkout-drawer ${phaseClass}`}
          role="dialog"
          aria-modal="true"
          aria-label="Checkout"
        >
          {renderDrawerContent()}
        </aside>
      </div>,
      document.body
    );
  }

  // ── DESKTOP: framer-motion (smooth on desktop GPU) ──
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

      <motion.aside
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
      </motion.aside>
    </div>,
    document.body
  );
}
