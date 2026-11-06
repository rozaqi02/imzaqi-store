import React, { act } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Pay from "./Pay";
import { ToastProvider } from "../context/ToastContext";
import { CartProvider } from "../context/CartContext";

vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

vi.mock("../lib/api", () => ({
  fetchProducts: vi.fn().mockResolvedValue([
    {
      id: "p-test-1",
      name: "Canva Pro",
      is_active: true,
      product_variants: [
        {
          id: "v-test-1",
          name: "1 Bulan Private",
          price_idr: 15000,
          stock: 5,
          is_active: true,
        },
      ],
    },
  ]),
  fetchSettings: vi.fn().mockResolvedValue({
    whatsapp: { number: "6283136049987" },
    qris: { image_url: "/qris_test.png" },
  }),
  fetchActiveFlashSales: vi.fn().mockResolvedValue([]),
  fetchPromoByCode: vi.fn().mockResolvedValue(null),
}));

const mockCartItem = {
  variant_id: "v-test-1",
  product_id: "p-test-1",
  product_name: "Canva Pro",
  variant_name: "1 Bulan Private",
  price_idr: 15000,
  qty: 1,
};

describe("Pay page component", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders without TDZ ReferenceError or crashing", async () => {
    await act(async () => {
      render(
        <MemoryRouter initialEntries={["/bayar"]}>
          <ToastProvider>
            <CartProvider>
              <Pay />
            </CartProvider>
          </ToastProvider>
        </MemoryRouter>
      );
    });
  });

  it("allows user to toggle contact details accordion without being forced closed", async () => {
    localStorage.setItem("imzaqi_store_cart_v1", JSON.stringify([mockCartItem]));
    localStorage.setItem("imzaqi_buyer_details_v1", JSON.stringify({ whatsapp: "081234567890" }));

    await act(async () => {
      render(
        <MemoryRouter initialEntries={["/bayar"]}>
          <ToastProvider>
            <CartProvider>
              <Pay />
            </CartProvider>
          </ToastProvider>
        </MemoryRouter>
      );
    });

    // Contact summary displays the entered WhatsApp
    expect(screen.getByText("081234567890")).toBeInTheDocument();

    const ubahBtn = screen.getByText("Ubah");
    expect(ubahBtn).toBeInTheDocument();

    // Toggle open
    fireEvent.click(ubahBtn);

    await waitFor(() => {
      expect(screen.getByText("Selesai")).toBeInTheDocument();
    });
  });
});
