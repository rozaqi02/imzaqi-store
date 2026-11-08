import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Products from "./Products";
import * as api from "../lib/api";

vi.mock("../lib/api", () => ({
  fetchProducts: vi.fn(),
  fetchActiveFlashSales: vi.fn(async () => []),
  peekCachedProducts: vi.fn(() => null),
  fetchSettings: vi.fn(async () => ({})),
}));

vi.mock("../context/CartContext", () => ({
  useCart: () => ({ items: [], add: vi.fn() }),
}));

vi.mock("../context/ToastContext", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

describe("Products page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves URL pmin and pmax parameters when products load", async () => {
    const mockProducts = [
      {
        id: "p1",
        name: "Netflix Premium",
        slug: "netflix-premium",
        is_active: true,
        product_variants: [
          { id: "v1", name: "1 Bulan", price_idr: 25000, is_active: true, stock: 5 },
          { id: "v2", name: "3 Bulan", price_idr: 70000, is_active: true, stock: 5 },
        ],
      },
      {
        id: "p2",
        name: "Spotify Premium",
        slug: "spotify-premium",
        is_active: true,
        product_variants: [
          { id: "v3", name: "1 Bulan", price_idr: 15000, is_active: true, stock: 5 },
        ],
      },
    ];

    vi.spyOn(api, "fetchProducts").mockResolvedValue(mockProducts);

    render(
      <MemoryRouter initialEntries={["/produk?pmin=20000&pmax=80000"]}>
        <Products />
      </MemoryRouter>
    );

    // Wait for async fetch and the 140ms isFiltering transition
    await screen.findByText("Netflix Premium", {}, { timeout: 2000 });

    // Netflix (min price 25000) should be within 20000 - 80000
    expect(screen.getByText("Netflix Premium")).toBeInTheDocument();
    // Spotify (min price 15000, max price 15000) is below 20000, so it should be filtered out
    expect(screen.queryByText("Spotify Premium")).not.toBeInTheDocument();
  });
});
