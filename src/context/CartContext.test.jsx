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
});
