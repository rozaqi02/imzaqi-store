import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ShoppingBag, Sparkles, TicketPercent, X } from "lucide-react";
import { useCart } from "../context/CartContext";
import { usePromo } from "../hooks/usePromo";
import { formatIDR } from "../lib/format";
import CheckoutSteps from "../components/CheckoutSteps";
import EmptyState from "../components/EmptyState";
import { useToast } from "../context/ToastContext";
import { usePageMeta } from "../hooks/usePageMeta";

function calcTotal(subtotal, percent) {
  const discount = Math.round((subtotal * (percent || 0)) / 100);
  return { discount, total: Math.max(0, subtotal - discount) };
}

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] },
  },
};

const desktopDrawerVariants = {
  hidden: { x: "100%", opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: {
      type: "spring",
      damping: 30,
      stiffness: 300,
      mass: 0.82,
    },
  },
  exit: {
    x: "100%",
    opacity: 0,
    transition: {
      type: "spring",
      damping: 30,
      stiffness: 300,
      mass: 0.82,
    },
  },
};

const mobileDrawerVariants = {
  hidden: { y: "100%", opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      damping: 34,
      stiffness: 320,
      mass: 0.86,
    },
  },
  exit: {
    y: "100%",
    opacity: 0,
    transition: {
      type: "spring",
      damping: 34,
      stiffness: 320,
      mass: 0.86,
    },
  },
};

export default function Checkout() {
  const nav = useNavigate();
  const location = useLocation();
  const cart = useCart();
  const { promo, apply, clear } = usePromo();
  const toast = useToast();
  const closeButtonRef = useRef(null);
  const reduceMotion = useReducedMotion();

  const promoPercent = Number(promo?.percent || 0);
  const subtotal = cart.subtotal();
  const { discount, total } = calcTotal(subtotal, promoPercent);

  const [code, setCode] = useState(() => promo?.code || "");
  const [msg, setMsg] = useState("");
  const [closing, setClosing] = useState(false);
  const [isMobileSheet, setIsMobileSheet] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 720px)").matches : false
  );
  const [showGestureHint, setShowGestureHint] = useState(true);

  usePageMeta({
    title: "Checkout",
    description: "Review order, promo, dan total sebelum lanjut ke halaman pembayaran.",
  });

  useEffect(() => {
    const next = promo?.code || "";
    setCode((prev) => (prev ? prev : next));
  }, [promo]);

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

  useEffect(() => {
    setShowGestureHint(true);

    const timer = window.setTimeout(() => {
      setShowGestureHint(false);
    }, reduceMotion ? 1800 : 3200);

    return () => window.clearTimeout(timer);
  }, [isMobileSheet, reduceMotion]);

  const itemCount = useMemo(() => cart.items.reduce((sum, item) => sum + Number(item.qty || 0), 0), [cart.items]);
  const backgroundLocation = location.state?.backgroundLocation;

  const requestClose = useCallback(() => {
    setClosing((prev) => (prev ? prev : true));
  }, []);

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
    }, 280);

    return () => window.clearTimeout(timer);
  }, [backgroundLocation, closing, nav]);

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
        <div className="checkout-summaryBadge">{discount > 0 ? `${promoPercent}% off` : "Ringkasan"}</div>
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

  if (typeof document === "undefined") return null;

  const drawerVariants = isMobileSheet ? mobileDrawerVariants : desktopDrawerVariants;

  return createPortal(
    <div className="checkout-overlay" role="presentation">
      <motion.div
        className="checkout-backdrop"
        variants={backdropVariants}
        initial="hidden"
        animate={closing ? "exit" : "visible"}
        onMouseDown={requestClose}
        aria-hidden="true"
      />

      <motion.aside
        className="checkout-drawer"
        variants={drawerVariants}
        initial="hidden"
        animate={closing ? "exit" : "visible"}
        drag={isMobileSheet ? "y" : true}
        dragConstraints={isMobileSheet ? { top: 0, bottom: 0 } : { left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={isMobileSheet ? (reduceMotion ? 0.06 : 0.1) : reduceMotion ? 0.1 : 0.16}
        dragDirectionLock
        onDragStart={() => setShowGestureHint(false)}
        onDragEnd={(event, info) => {
          if (isMobileSheet) {
            if (info.offset.y > 120 || info.velocity.y > 520) requestClose();
            return;
          }

          if (
            info.offset.x > 110 ||
            info.velocity.x > 500 ||
            info.offset.y > 130 ||
            info.velocity.y > 560
          ) {
            requestClose();
          }
        }}
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={() => setShowGestureHint(false)}
        style={{ touchAction: isMobileSheet ? "pan-y" : "none" }}
        role="dialog"
        aria-modal="true"
        aria-label="Checkout"
      >
        <div className="checkout-drawerHandle" aria-hidden="true" />
        {showGestureHint ? (
          <div className="checkout-drawerGesture" role="status" aria-live="polite">
            <span className="checkout-drawerGestureDot" aria-hidden="true" />
            <span>{isMobileSheet ? "Geser ke bawah untuk tutup" : "Geser panel atau klik X untuk tutup"}</span>
          </div>
        ) : null}

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

          {cart.items.length > 0 ? <div className="checkout-summary-mobileWrap">{renderSummary("checkout-summary-mobile")}</div> : null}

          <div className="checkout-drawerGrid">
            <section className="card pad checkout-panel checkout-main">
              <div className="checkout-main-head">
                <div>
                  <div className="checkout-main-kicker">Keranjang</div>
                  <h2 className="h3 checkout-main-title">{cart.items.length === 0 ? "Belum ada pilihan" : "Isi order"}</h2>
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
                    {cart.items.map((item) => (
                      <div key={item.variant_id} className="checkout-item-card">
                        <div className="checkout-item-copy">
                          <div className="checkout-item-name">{item.product_name}</div>
                          <div className="checkout-item-meta">
                            {item.variant_name} / {item.duration_label}
                          </div>
                        </div>

                        <div className="checkout-item-controls">
                          <div className="checkout-item-stepper">
                            <button className="qty-btn" onClick={() => cart.setQty(item.variant_id, item.qty - 1)} aria-label="Kurangi">
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
                            <button className="qty-btn" onClick={() => cart.setQty(item.variant_id, item.qty + 1)} aria-label="Tambah">
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
                      </div>
                    ))}
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

                    {msg ? <div className={`checkout-promo-message ${promoPercent ? "ok" : ""}`}>{msg}</div> : null}
                  </div>
                </>
              )}
            </section>

            {cart.items.length > 0 ? renderSummary("checkout-summary-desktop") : null}
          </div>
        </div>
      </motion.aside>
    </div>,
    document.body
  );
}
