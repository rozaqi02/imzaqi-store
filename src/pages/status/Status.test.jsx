import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Status from "../Status";
import { ToastProvider } from "../../context/ToastContext";
import { CartProvider } from "../../context/CartContext";
import { supabase } from "../../lib/supabaseClient";
import {
  formatReservationCountdown,
  getPaymentMethodLabel,
  getSafeOrderItems,
  getVerificationLabel,
  normalizeOrderCode,
} from "./statusHelpers";

vi.mock("../../lib/supabaseClient", () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

vi.mock("../../lib/api", () => ({
  fetchSettings: vi.fn().mockResolvedValue({ whatsapp: { number: "6283136049987" } }),
  fetchProducts: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../components/Confetti", () => ({
  fireConfetti: vi.fn(),
}));

vi.mock("../../lib/funnelAnalytics", () => ({
  trackFunnelEvent: vi.fn(),
}));

function renderStatus(initialEntry = "/status") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ToastProvider>
        <CartProvider>
          <Status />
        </CartProvider>
      </ToastProvider>
    </MemoryRouter>
  );
}

describe("statusHelpers", () => {
  it("normalizes order codes and formats safe item arrays", () => {
    expect(normalizeOrderCode(" abcd1234 ")).toBe("IMZ-ABCD1234");
    expect(normalizeOrderCode("imz-xy990011")).toBe("IMZ-XY990011");
    expect(getSafeOrderItems('[{"product_name":"Canva","qty":2}]')).toHaveLength(1);
    expect(getSafeOrderItems(null)).toEqual([]);
  });

  it("formats reservation countdown only for pending orders", () => {
    const now = Date.parse("2026-11-17T10:00:00Z");
    expect(
      formatReservationCountdown(
        { status: "pending", reservation_expires_at: "2026-11-17T10:12:05Z" },
        now
      )
    ).toEqual({ label: "Batas bayar 12:05", isExpired: false });

    expect(
      formatReservationCountdown(
        { status: "pending", reservation_expires_at: "2026-11-17T09:59:00Z" },
        now
      )
    ).toEqual({ label: "Batas pembayaran berakhir", isExpired: true });

    expect(
      formatReservationCountdown(
        { status: "done", reservation_expires_at: "2026-11-17T10:12:05Z" },
        now
      )
    ).toBeNull();
  });

  it("derives honest payment method and verification labels", () => {
    expect(getPaymentMethodLabel({ total_idr: 0 })).toBe("Gratis (Promo 100%)");
    expect(getPaymentMethodLabel({ total_idr: 15000, payment_reference: "QRIS-991" })).toBe("QRIS · QRIS-991");
    expect(getPaymentMethodLabel({ total_idr: 15000 })).toBe("QRIS");
    expect(getVerificationLabel({ verification_status: "verified" })).toBe("Terverifikasi");
    expect(getVerificationLabel({ verification_status: "reported" })).toBe("Menunggu dicek");
  });
});

describe("Status page composition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("shows hero, checkout steps, and search card when no order is loaded", async () => {
    localStorage.setItem(
      "imzaqi_order_history_v1",
      JSON.stringify([
        { order_code: "IMZ-HIST0001", created_at: "2026-11-17T09:00:00Z", total_idr: 15000, status: "pending" },
      ])
    );

    renderStatus("/status");

    await screen.findByText("Masukkan ID pesanan");
    expect(screen.getByText(/Sudah pesan\?/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /IMZ-HIST0001/i })).toBeTruthy();
  });

  it("focuses pending order with countdown, single proof WA CTA, and no duplicate total", async () => {
    const expiresFuture = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    supabase.rpc.mockResolvedValueOnce({
      data: [
        {
          order_code: "IMZ-PEND1234",
          status: "pending",
          created_at: "2026-11-17T12:00:00Z",
          subtotal_idr: 20000,
          discount_percent: 0,
          total_idr: 20000,
          promo_code: null,
          reservation_expires_at: expiresFuture,
          items: [
            {
              product_name: "YouTube Premium",
              variant_name: "FamPlan",
              duration_label: "1 Bulan",
              guarantee_text: "Garansi penuh",
              price_idr: 20000,
              qty: 1,
              description: "Deskripsi panjang produk YouTube yang dilipat.",
            },
          ],
        },
      ],
      error: null,
    });

    const { container } = renderStatus("/status?order=IMZ-PEND1234");

    await waitFor(() => {
      expect(container.querySelector(".st-orderCodeText")?.textContent).toBe("IMZ-PEND1234");
    });

    // Hero and checkout steps are hidden in focused order view
    expect(container.querySelector(".store-hero--status")).toBeNull();
    expect(container.querySelector(".st-checkoutSteps")).toBeNull();

    // Compact search bar stays accessible at top
    expect(container.querySelector(".st-search.st-search--compact")).not.toBeNull();

    // Countdown & single proof WA button
    expect(screen.getByText(/Batas bayar/i)).toBeTruthy();
    expect(screen.getAllByText("Kirim Bukti via WA")).toHaveLength(1);

    // Total Tagihan appears only once
    expect(screen.getAllByText("Total Tagihan")).toHaveLength(1);

    // Product description starts collapsed inside <details>
    const detailsEl = container.querySelector(".st-itemDescDetails");
    expect(detailsEl).not.toBeNull();
    expect(detailsEl.open).toBe(false);
  });

  it("shows proof preview & late payment badge for paid_reported orders", async () => {
    supabase.rpc.mockResolvedValueOnce({
      data: [
        {
          order_code: "IMZ-RPTD5678",
          status: "paid_reported",
          created_at: "2026-11-17T11:00:00Z",
          payment_reported_at: "2026-11-17T12:15:00Z",
          payment_proof_url: "https://example.com/proof.jpg",
          verification_status: "reported",
          late_payment_report: true,
          subtotal_idr: 15000,
          discount_percent: 0,
          total_idr: 15000,
          items: [{ product_name: "Viu", variant_name: "Private", price_idr: 15000, qty: 1 }],
        },
      ],
      error: null,
    });

    const { container } = renderStatus("/status?order=IMZ-RPTD5678");

    await waitFor(() => {
      expect(container.querySelector(".st-orderCodeText")?.textContent).toBe("IMZ-RPTD5678");
    });

    expect(screen.getByText("Lewat batas waktu")).toBeTruthy();
    expect(screen.getByAltText("Bukti pembayaran pesanan")).toBeTruthy();
    expect(screen.getByText("Menunggu dicek")).toBeTruthy();
  });

  it("shows credentials copy buttons, promo inline, buyer email, and expandable review strip for done orders", async () => {
    supabase.rpc.mockResolvedValueOnce({
      data: [
        {
          order_code: "IMZ-DONE9999",
          status: "done",
          created_at: "2026-11-17T10:00:00Z",
          subtotal_idr: 30000,
          discount_percent: 10,
          total_idr: 27000,
          promo_code: "HEMAT10",
          buyer_email: "pembeli@example.com",
          verification_status: "verified",
          notes: "Tolong diproses cepat min",
          admin_note: "Email: akun@example.com\nPassword: rahasia123",
          items: [
            {
              product_name: "Canva Pro",
              variant_name: "Invite Tim",
              duration_label: "1 Bulan",
              requires_buyer_email: true,
              price_idr: 30000,
              qty: 1,
            },
          ],
        },
      ],
      error: null,
    });

    const { container } = renderStatus("/status?order=IMZ-DONE9999");

    await waitFor(() => {
      expect(container.querySelector(".st-orderCodeText")?.textContent).toBe("IMZ-DONE9999");
    });

    expect(screen.getByRole("button", { name: "Email" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Password" })).toBeTruthy();
    expect(screen.getByText("HEMAT10")).toBeTruthy();
    expect(screen.getByText("pembeli@example.com")).toBeTruthy();
    expect(screen.getByText("Tolong diproses cepat min")).toBeTruthy();
    expect(screen.getByText("Terverifikasi")).toBeTruthy();

    // Compact review strip starts collapsed until user picks a star or clicks "Tulis ulasan"
    expect(container.querySelector(".st-reviewForm")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "5 bintang" }));
    expect(container.querySelector(".st-reviewForm")).not.toBeNull();
    expect(screen.getByRole("button", { name: /Kirim Ulasan/i })).toBeTruthy();
  });
});
