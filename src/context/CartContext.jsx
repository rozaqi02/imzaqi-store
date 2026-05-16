import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { clamp } from "../lib/format";
import { supabase } from "../lib/supabaseClient";

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

export function CartProvider({ children }) {
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
  }, [items]);

  const api = useMemo(() => ({
    items,

    add(variant, qty = 1) {
      setItems(prev => {
        const i = prev.findIndex(x => x.variant_id === variant.id);
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
            requires_buyer_email:
              typeof variant.requires_buyer_email === "boolean"
                ? variant.requires_buyer_email
                : !!next[i].requires_buyer_email,
            qty: clamp(next[i].qty + qty, 1, 99),
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
            requires_buyer_email: !!variant.requires_buyer_email,
            qty: clamp(qty, 1, 99),
          },
        ];
      });
    },

    remove(variant_id) {
      setItems(prev => prev.filter(x => x.variant_id !== variant_id));
    },

    setQty(variant_id, qty) {
      setItems(prev => prev.map(x => x.variant_id === variant_id ? { ...x, qty: clamp(qty, 1, 99) } : x));
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

  }), [items]);

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
