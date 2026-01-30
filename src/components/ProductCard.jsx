import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatIDR } from "../lib/format";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";

const LOGO_BY_SLUG = {
  netflix: "https://logo.clearbit.com/netflix.com",
  canva: "https://logo.clearbit.com/canva.com",
  "youtube-premium": "https://logo.clearbit.com/youtube.com",
  spotify: "https://logo.clearbit.com/spotify.com",
  "prime-video": "https://logo.clearbit.com/primevideo.com",
  "disney-hotstar": "https://logo.clearbit.com/hotstar.com",
  iqiyi: "https://logo.clearbit.com/iq.com",
  viu: "https://logo.clearbit.com/viu.com",
  vidio: "https://logo.clearbit.com/vidio.com",
  capcut: "https://logo.clearbit.com/capcut.com",
  "zoom-pro": "https://logo.clearbit.com/zoom.us",
  bstation: "https://logo.clearbit.com/bilibili.tv",
  getcontact: "https://logo.clearbit.com/getcontact.com",
  duolingo: "https://logo.clearbit.com/duolingo.com",
  "chatgpt-plus": "https://logo.clearbit.com/openai.com",
};

// Stock Badge Component with animations
function StockBadge({ stock }) {
  if (stock === undefined || stock === null) return null;

  const getBadgeConfig = () => {
    if (stock === 0) {
      return {
        label: "Habis",
        className: "out-of-stock",
        icon: "🚫",
        bgColor: "rgba(239, 68, 68, 0.15)",
        textColor: "#ef4444",
      };
    }
    if (stock <= 5) {
      return {
        label: `Tersisa ${stock}`,
        className: "low-stock",
        icon: "⚡",
        bgColor: "rgba(249, 115, 22, 0.15)",
        textColor: "#f97316",
      };
    }
    if (stock <= 20) {
      return {
        label: "Terbatas",
        className: "limited-stock",
        icon: "⏱️",
        bgColor: "rgba(251, 191, 36, 0.15)",
        textColor: "#fbbf24",
      };
    }
    return {
      label: "Tersedia",
      className: "in-stock",
      icon: "✓",
      bgColor: "rgba(34, 197, 94, 0.15)",
      textColor: "#22c55e",
    };
  };

  const config = getBadgeConfig();

  return (
    <motion.span
      className={`stock-badge-modern ${config.className}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 25 }}
      style={{
        backgroundColor: config.bgColor,
        color: config.textColor,
      }}
    >
      <span className="stock-icon">{config.icon}</span>
      <span className="stock-label">{config.label}</span>
      {stock <= 5 && stock > 0 && (
        <motion.span
          className="stock-pulse"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}
    </motion.span>
  );
}

// Stock Progress Bar
function StockProgress({ stock, maxStock = 100 }) {
  if (stock === undefined || stock === null) return null;

  const percentage = Math.min((stock / maxStock) * 100, 100);
  const getColor = () => {
    if (stock === 0) return "#ef4444";
    if (stock <= 5) return "#f97316";
    if (stock <= 20) return "#fbbf24";
    return "#22c55e";
  };

  return (
    <div className="stock-progress-container">
      <div className="stock-progress-bar">
        <motion.div
          className="stock-progress-fill"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ backgroundColor: getColor() }}
        />
      </div>
      <div className="stock-progress-text">
        <span className="stock-count">{stock}</span>
        <span className="stock-unit">unit</span>
      </div>
    </div>
  );
}

export default function ProductCard({ product }) {
  const { add } = useCart();
  const toast = useToast();
  const [imgError, setImgError] = useState(false);
  const [expandedVariant, setExpandedVariant] = useState(null);
  const [isHovered, setIsHovered] = useState(false);

  const variants = useMemo(
    () =>
      (product?.product_variants || [])
        .slice()
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [product]
  );

  const logoSrc = product?.icon_url || LOGO_BY_SLUG[product?.slug] || "";
  const fallbackLetter = (product?.name || "P").trim().slice(0, 1).toUpperCase();

  // Calculate total stock for product
  const totalStock = useMemo(() => {
    return variants.reduce((sum, v) => sum + (v.stock ?? 999), 0);
  }, [variants]);

  function handleAddToCart(variant) {
    const stock = variant.stock ?? 999;

    if (stock === 0) {
      toast.error("Produk ini sedang habis", {
        title: variant.name,
        duration: 3000,
      });
      return;
    }

    add(
      {
        ...variant,
        product_id: product.id,
        product_name: product.name,
      },
      1
    );

    toast.success(`${variant.name} • ${formatIDR(variant.price_idr)}`, {
      title: "✓ Ditambahkan ke keranjang",
      duration: 2200,
    });
  }

  return (
    <motion.div
      className="product-card-modern"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      {/* Card Background Glow Effect */}
      <motion.div
        className="card-glow"
        animate={{
          opacity: isHovered ? 0.6 : 0,
          scale: isHovered ? 1 : 0.8,
        }}
        transition={{ duration: 0.3 }}
      />

      {/* Header Section */}
      <div className="product-card-header">
        <div className="product-header-left">
          <motion.div
            className="product-logo-wrapper"
            whileHover={{ scale: 1.05, rotate: 2 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            {logoSrc && !imgError ? (
              <img
                className="product-logo-modern"
                src={logoSrc}
                alt={`${product.name} logo`}
                loading="lazy"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="product-logo-fallback-modern">
                {fallbackLetter}
              </div>
            )}
          </motion.div>

          <div className="product-info">
            <h3 className="product-name-modern">{product.name}</h3>
            <p className="product-desc-modern">{product.description}</p>
          </div>
        </div>

        <div className="product-badges">
          <span className="guarantee-badge">✓ Garansi</span>
          {totalStock <= 50 && totalStock > 0 && (
            <motion.span
              className="trending-badge"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
            >
              🔥 Trending
            </motion.span>
          )}
        </div>
      </div>

      {/* Variants Section */}
      <div className="variants-container-modern">
        <AnimatePresence mode="popLayout">
          {variants.map((v, index) => {
            const stock = v.stock ?? 999;
            const isOutOfStock = stock === 0;
            const isExpanded = expandedVariant === v.id;

            return (
              <motion.div
                key={v.id}
                layout
                className={`variant-card-modern ${isOutOfStock ? "variant-disabled" : ""}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{
                  delay: index * 0.05,
                  type: "spring",
                  stiffness: 300,
                  damping: 25,
                }}
              >
                <div className="variant-main">
                  <div className="variant-info-left">
                    <div className="variant-header-row">
                      <span className="variant-name-modern">{v.name}</span>
                      <StockBadge stock={v.stock} />
                    </div>
                    <div className="variant-details">
                      <span className="variant-duration">{v.duration_label}</span>
                      {v.guarantee_text && (
                        <span className="variant-guarantee">• {v.guarantee_text}</span>
                      )}
                    </div>

                    {/* Stock Progress Bar (only show if stock data exists) */}
                    {stock !== 999 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{
                          opacity: isExpanded ? 1 : 0,
                          height: isExpanded ? "auto" : 0,
                        }}
                        transition={{ duration: 0.2 }}
                      >
                        <StockProgress stock={stock} maxStock={100} />
                      </motion.div>
                    )}
                  </div>

                  <div className="variant-action">
                    <div className="variant-price-modern">{formatIDR(v.price_idr)}</div>
                    <motion.button
                      className={`btn-add-cart-modern ${isOutOfStock ? "btn-disabled" : ""}`}
                      onClick={() => handleAddToCart(v)}
                      disabled={isOutOfStock}
                      whileHover={!isOutOfStock ? { scale: 1.05 } : {}}
                      whileTap={!isOutOfStock ? { scale: 0.95 } : {}}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    >
                      {isOutOfStock ? (
                        <>
                          <span>🚫</span>
                          <span>Habis</span>
                        </>
                      ) : (
                        <>
                          <motion.span
                            animate={{ rotate: [0, 10, 0] }}
                            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                          >
                            🛒
                          </motion.span>
                          <span>Tambah</span>
                        </>
                      )}
                    </motion.button>
                  </div>
                </div>

                {/* Expand button for stock details */}
                {stock !== 999 && (
                  <motion.button
                    className="variant-expand-btn"
                    onClick={() => setExpandedVariant(isExpanded ? null : v.id)}
                    whileTap={{ scale: 0.9 }}
                  >
                    <motion.span
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      ↓
                    </motion.span>
                  </motion.button>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Footer Stats */}
      {variants.length > 0 && (
        <motion.div
          className="product-card-footer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="footer-stat">
            <span className="stat-icon">📦</span>
            <span className="stat-text">{variants.length} Paket</span>
          </div>
          {totalStock !== 999 * variants.length && (
            <div className="footer-stat">
              <span className="stat-icon">📊</span>
              <span className="stat-text">Total: {totalStock} unit</span>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}