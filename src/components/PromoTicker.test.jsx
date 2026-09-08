import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PromoTicker from "./PromoTicker";

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

  it("prioritizes the flash sale instead of stacking a second promo row", async () => {
    await renderTicker();

    expect(screen.getByText(/Flash sale/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Gemini AI Pro · 30 Hari" })).toHaveAttribute("href", "/produk/gemini-ai-pro");
    expect(screen.getByText(/-38%/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salin kode promo HEMAT20" })).toBeNull();
    expect(screen.getByRole("link", { name: "Gemini AI Pro · 30 Hari" })).toBeInTheDocument();
  });

  it("rotates to the next flash-sale product after 6 seconds", async () => {
    await renderTicker();

    expect(screen.getByRole("link", { name: "Gemini AI Pro · 30 Hari" })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.getByRole("link", { name: "Netflix Premium · 28 Hari" })).toHaveAttribute("href", "/produk/netflix-premium");
  });
});
