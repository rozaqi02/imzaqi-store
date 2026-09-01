import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { clamp } from "../lib/format";
import { supabase } from "../lib/supabaseClient";
import { touchCartActivity } from "../lib/cartReminder";

const CartContext = createContext(null);

const STORAGE_KEY = "imzaqi_store_cart_v1";

function safeStorage() {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function safeParse(json, fallback) {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function getItemCategoryLine(item) {
  if (item?.category === "academic" || item?.catalog_line === "academic") return "academic";
  const name = String(item?.product_name || item?.name || item?.variant_name || "").toLowerCase();
  if (/turnitin|parafrase|paraphrase|plagiasi|zerogpt|mendeley|skripsi|tesis|jurnal|akademik/.test(name)) {
    return "academic";
  }
  return "app_premium";
}

export function CartProvider({ children }) {
  const [bumpToken, setBumpToken] = useState(0);
  const [lastAddedVariantId, setLastAddedVariantId] = useState(null);
  const lastAddedTimerRef = React.useRef(null);
  const [items, setItems] = useState(() => {
    const storage = safeStorage();
    if (!storage) return [];
    return safeParse(storage.getItem(STORAGE_KEY), []);
  });
  useEffect(() => {
    const storage = safeStorage();
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
    if (items.length > 0) touchCartActivity();
  }, [items]);

  const api = useMemo(() => ({
    items,

    bumpToken,
    lastAddedVariantId,

    add(variant, qty = 1) {
      const requestedQty = Math.max(1, Math.floor(Number(qty) || 1));
      const availableStock = Number(variant?.stock);
      const newItemCategory = getItemCategoryLine(variant);
      const hasConflict = items.some((existingItem) => {
        const existingCategory = getItemCategoryLine(existingItem);
        return existingCategory !== newItemCategory;
      });

      if (hasConflict) {
        return {
          success: false,
          conflict: true,
          conflictType: "mixed_category",
          message:
            "Produk 'Jasa Akademik' dan 'Aplikasi Premium' harus dipesan secara terpisah karena memiliki metode pembayaran QRIS yang berbeda. Mohon selesaikan atau kosongkan pesanan sebelumnya terlebih dahulu.",
        };
      }

      const existingItem = items.find((item) => item.variant_id === variant.id);
      const nextQty = Number(existingItem?.qty || 0) + requestedQty;
      if (Number.isFinite(availableStock) && availableStock >= 0 && nextQty > availableStock) {
        return {
          success: false,
          outOfStock: true,
          available: availableStock,
          message: availableStock > 0
            ? `Stok tersisa ${availableStock}. Jumlah di keranjang tidak boleh melebihi stok.`
            : "Produk ini sedang habis.",
        };
      }

      setBumpToken((t) => t + 1);
      setLastAddedVariantId(variant.id);
      // Track timer agar bisa di-cancel sebelum set ulang
      if (lastAddedTimerRef.current) window.clearTimeout(lastAddedTimerRef.current);
      lastAddedTimerRef.current = window.setTimeout(() => {
        setLastAddedVariantId(null);
        lastAddedTimerRef.current = null;
      }, 900);
      setItems((prev) => {
        const i = prev.findIndex((x) => x.variant_id === variant.id);
        if (i >= 0) {
          const next = [...prev];
          next[i] = {
            ...next[i],
            product_id: variant.product_id ?? next[i].product_id,
            product_name: variant.product_name ?? next[i].product_name,
            variant_name: variant.name ?? next[i].variant_name,
            duration_label: variant.duration_label ?? next[i].duration_label,
            price_idr: variant.price_idr ?? next[i].price_idr,
            product_icon_url:
              variant.product_icon_url ??
              variant.icon_url ??
              next[i].product_icon_url ??
              "",
            description: variant.description ?? next[i].description,
            guarantee_text: variant.guarantee_text ?? next[i].guarantee_text,
            catalog_line: newItemCategory,
            requires_buyer_email:
              typeof variant.requires_buyer_email === "boolean"
                ? variant.requires_buyer_email
                : !!next[i].requires_buyer_email,
            stock: Number.isFinite(availableStock) ? availableStock : next[i].stock,
            qty: clamp(next[i].qty + requestedQty, 1, 99),
          };
          return next;
        }
        return [
          ...prev,
          {
            variant_id: variant.id,
            product_id: variant.product_id,
            product_name: variant.product_name,
            variant_name: variant.name,
            duration_label: variant.duration_label,
            price_idr: variant.price_idr,
            product_icon_url: variant.product_icon_url || variant.icon_url || "",
            description: variant.description || "",
            guarantee_text: variant.guarantee_text || "",
            catalog_line: newItemCategory,
            requires_buyer_email: !!variant.requires_buyer_email,
            stock: Number.isFinite(availableStock) ? availableStock : null,
            qty: clamp(requestedQty, 1, 99),
          },
        ];
      });
      return { success: true };
    },

    remove(variant_id) {
      setItems(prev => prev.filter(x => x.variant_id !== variant_id));
    },

    setQty(variant_id, qty) {
      setItems(prev => prev.map((x) => {
        if (x.variant_id !== variant_id) return x;
        const maxQty = Number.isFinite(Number(x.stock)) && Number(x.stock) >= 0
          ? Math.min(99, Number(x.stock))
          : 99;
        return { ...x, qty: clamp(qty, 1, Math.max(1, maxQty)) };
      }));
    },

    clear() {
      setItems([]);
    },

    subtotal() {
      return items.reduce((sum, x) => sum + (x.price_idr * x.qty), 0);
    },

    // TAMBAHKAN INI (Alias agar cart.total() jalan)
    total() {
      return items.reduce((sum, x) => sum + (x.price_idr * x.qty), 0);
    },

    async checkStockForVariant(variantId) {
      try {
        const { data, error } = await supabase
          .from("product_variants")
          .select("id, name, stock")
          .eq("id", variantId)
          .single();
        if (error) return null;
        return data;
      } catch {
        return null;
      }
    },

  }), [items, bumpToken, lastAddedVariantId]);

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
