import React from "react";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CartProvider, useCart } from "./CartContext";

vi.mock("../lib/supabaseClient", () => ({ supabase: {} }));
vi.mock("../lib/cartReminder", () => ({ touchCartActivity: vi.fn() }));

const STORAGE_KEY = "imzaqi_store_cart_v1";

function Probe({ onValue }) {
  const cart = useCart();
  onValue(cart);
  return null;
}

describe("CartProvider live synchronization", () => {
  beforeEach(() => localStorage.clear());

  it("updates stock and buyer-email requirement even when price and names stay equal", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{
      variant_id: "variant-1",
      product_name: "Canva",
      variant_name: "Private",
      duration_label: "1 bulan",
      price_idr: 10000,
      stock: 10,
      qty: 1,
      requires_buyer_email: false,
    }]));
    let current;
    render(<CartProvider><Probe onValue={(value) => { current = value; }} /></CartProvider>);

    act(() => current.syncPrices([{
      variant_id: "variant-1",
      product_name: "Canva",
      variant_name: "Private",
      duration_label: "1 bulan",
      price_idr: 10000,
      stock: 2,
      requires_buyer_email: true,
    }]));

    expect(current.items[0]).toMatchObject({ stock: 2, requires_buyer_email: true });
  });

  it("allows adding and increasing qty for untracked stock (stock: null)", () => {
    let current;
    render(<CartProvider><Probe onValue={(value) => { current = value; }} /></CartProvider>);

    let result;
    act(() => {
      result = current.add({
        id: "variant-untracked",
        product_id: "prod-1",
        product_name: "Netflix",
        name: "Sharing 1 Bulan",
        price_idr: 25000,
        stock: null,
      }, 1);
    });

    expect(result.success).toBe(true);
    expect(current.items).toHaveLength(1);
    expect(current.items[0].qty).toBe(1);

    // Can increase qty above 1 for untracked stock
    act(() => {
      current.setQty("variant-untracked", 5);
    });
    expect(current.items[0].qty).toBe(5);
  });

  it("rejects adding when stock is explicitly 0", () => {
    let current;
    render(<CartProvider><Probe onValue={(value) => { current = value; }} /></CartProvider>);

    let result;
    act(() => {
      result = current.add({
        id: "variant-out",
        product_id: "prod-2",
        product_name: "Spotify",
        name: "Individual",
        price_idr: 30000,
        stock: 0,
      }, 1);
    });

    expect(result.success).toBe(false);
    expect(result.outOfStock).toBe(true);
    expect(current.items).toHaveLength(0);
  });
});
