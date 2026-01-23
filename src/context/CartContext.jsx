import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { clamp } from "../lib/format";

const CartContext = createContext(null);

const STORAGE_KEY = "imzaqi_store_cart_v1";

function safeParse(json, fallback) {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => safeParse(localStorage.getItem(STORAGE_KEY), []));

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const api = useMemo(() => ({
    items,

    add(variant, qty = 1) {
      setItems(prev => {
        const i = prev.findIndex(x => x.variant_id === variant.id);
        if (i >= 0) {
          const next = [...prev];
          next[i] = { ...next[i], qty: clamp(next[i].qty + qty, 1, 99) };
          return next;
        }
        return [...prev, {
          variant_id: variant.id,
          product_id: variant.product_id,
          product_name: variant.product_name,
          variant_name: variant.name,
          duration_label: variant.duration_label,
          price_idr: variant.price_idr,
          qty: clamp(qty, 1, 99),
        }];
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
  }), [items]);

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
