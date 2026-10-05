import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PromoTicker from "./PromoTicker";
import { fetchActiveFlashSales, fetchSettings } from "../lib/api";

vi.mock("../lib/api", () => ({
  fetchActiveFlashSales: vi.fn(async () => [
    {
      id: "s1",
      variant_id: "v1",
      discount_percent: 38,
      ends_at: new Date(Date.now() + 86400000).toISOString(),
    },
    {
      id: "s2",
      variant_id: "v2",
      discount_percent: 20,
      ends_at: new Date(Date.now() + 86400000).toISOString(),
    },
  ]),
  fetchProducts: vi.fn(async () => [
    {
      id: "p1",
      name: "Gemini AI Pro",
      slug: "gemini-ai-pro",
      product_variants: [{ id: "v1", duration_label: "30 Hari", is_active: true, stock: 4 }],
    },
    {
      id: "p2",
      name: "Netflix Premium",
      slug: "netflix-premium",
      product_variants: [{ id: "v2", duration_label: "28 Hari", is_active: true, stock: 2 }],
    },
  ]),
  fetchPromoCodes: vi.fn(async () => [
    { code: "HEMAT20", percent: 20, is_active: true, used_count: 0, max_uses: null, expired_at: null },
  ]),
  fetchSettings: vi.fn(async () => ({
    home_promos: { codes: ["HEMAT20"] },
  })),
}));

vi.mock("../utils/clipboard", () => ({
  copyToClipboard: vi.fn(async () => {}),
}));

describe("PromoTicker", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
  });

  async function renderTicker() {
    render(
      <MemoryRouter>
        <PromoTicker />
      </MemoryRouter>
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("offers both banners with the second row marked as mobile-only during flash sales", async () => {
    await renderTicker();

    expect(screen.getByText(/Flash sale/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Gemini AI Pro · 30 Hari" })).toHaveAttribute("href", "/produk/gemini-ai-pro");
    expect(screen.getByText(/-38%/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Kode promo" })).toHaveClass("promo-ticker--mobileStack");
    expect(screen.getByRole("button", { name: "Salin kode promo HEMAT20" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Gemini AI Pro · 30 Hari" })).toBeInTheDocument();
  });

  it("dismisses each banner independently and remembers it for the session", async () => {
    await renderTicker();
    fireEvent.click(screen.getByRole("button", { name: "Tutup banner flash sale" }));
    expect(screen.queryByRole("region", { name: "Flash sale" })).toBeNull();
    expect(screen.getByRole("region", { name: "Kode promo" })).toBeInTheDocument();
    expect(sessionStorage.getItem("imzaqi_ticker_flash_dismissed")).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "Tutup kode promo" }));
    expect(screen.queryByRole("region", { name: "Kode promo" })).toBeNull();
    expect(sessionStorage.getItem("imzaqi_ticker_promo_dismissed")).toBe("1");
  });

  it("rotates to the next flash-sale product after 6 seconds", async () => {
    await renderTicker();

    expect(screen.getByRole("link", { name: "Gemini AI Pro · 30 Hari" })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.getByRole("link", { name: "Netflix Premium · 28 Hari" })).toHaveAttribute("href", "/produk/netflix-premium");
  });
  it("uses automatic product copy, destination, and selected color for a new-product banner", async () => {
    fetchSettings.mockResolvedValueOnce({ new_product_banner: { enabled: true, product_id: "p1", color: "yellow" } });
    await renderTicker();
    const banner = screen.getByRole("region", { name: "Produk baru" });
    expect(banner).toHaveClass("promo-ticker--color-yellow");
    expect(screen.getByRole("link", { name: "Gemini AI Pro sekarang tersedia. Lihat paketnya!" })).toHaveAttribute("href", "/produk/gemini-ai-pro");
  });
  it("supports an external announcement destination without treating it as a router path", async () => {
    fetchSettings.mockResolvedValueOnce({ new_product_banner: { enabled: true, text: "Hubungi toko", link: "https://example.com/contact" } });
    await renderTicker();
    expect(screen.getByRole("link", { name: "Hubungi toko" })).toHaveAttribute("href", "https://example.com/contact");
  });
  it("shows an active flash announcement once and hides the duplicate flash row", async () => {
    fetchActiveFlashSales.mockResolvedValueOnce([{ variant_id: "v1", discount_percent: 38, starts_at: new Date(Date.now() - 60000).toISOString(), ends_at: new Date(Date.now() + 60000).toISOString() }]);
    fetchSettings.mockResolvedValueOnce({ new_product_banner: { enabled: true, type: "flash", color: "red" } });
    await renderTicker();
    expect(screen.getByRole("region", { name: "Flash sale pilihan" })).toHaveClass("promo-ticker--color-red");
    expect(screen.getByRole("link", { name: "Flash sale Gemini AI Pro · -38%" })).toHaveAttribute("href", "/produk/gemini-ai-pro");
    expect(screen.queryByRole("region", { name: "Flash sale" })).toBeNull();
  });
  it("shows service banner when enabled in admin settings and hides it when disabled", async () => {
    fetchActiveFlashSales.mockResolvedValueOnce([]);
    fetchSettings.mockResolvedValueOnce({ service_banner: { enabled: true, text: "Proses 5–30 menit · Garansi replace · Checkout QRIS", color: "green" } });
    await renderTicker();
    expect(screen.getByRole("region", { name: "Info layanan" })).toBeInTheDocument();
    expect(screen.getByText("Proses 5–30 menit · Garansi replace · Checkout QRIS")).toBeInTheDocument();
  });
  it("does not show service banner when disabled in settings", async () => {
    fetchActiveFlashSales.mockResolvedValueOnce([]);
    fetchSettings.mockResolvedValueOnce({ service_banner: { enabled: false } });
    await renderTicker();
    expect(screen.queryByRole("region", { name: "Info layanan" })).toBeNull();
  });
});
