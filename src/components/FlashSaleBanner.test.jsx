import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import FlashSaleBanner from "./FlashSaleBanner";
import { fetchActiveFlashSales } from "../lib/api";

vi.mock("../lib/api", () => ({ fetchActiveFlashSales: vi.fn() }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("FlashSaleBanner", () => {
  it("selects a real package, updates its price and deadline, and links to its product", async () => {
    const now = Date.now();
    fetchActiveFlashSales.mockResolvedValue([
      { id: "a", variant_id: "v1", discount_percent: 30, is_active: true, starts_at: new Date(now - 1000).toISOString(), ends_at: new Date(now + 3_600_000).toISOString() },
      { id: "b", variant_id: "v2", discount_percent: 20, is_active: true, starts_at: new Date(now - 1000).toISOString(), ends_at: new Date(now + 7_200_000).toISOString() },
    ]);
    const products = [
      { id: "p1", slug: "canva", name: "Canva", icon_url: "/canva.png", product_variants: [{ id: "v1", name: "Pro", duration_label: "1 Bulan", price_idr: 20000, stock: 4 }] },
      { id: "p2", slug: "netflix", name: "Netflix", product_variants: [{ id: "v2", name: "Private", duration_label: "1 Bulan", price_idr: 30000, stock: null }] },
    ];
    render(<MemoryRouter><FlashSaleBanner products={products} /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole("link", { name: /Lihat paket Canva, Pro/ })).toHaveAttribute("href", "/produk/canva"));
    expect(screen.getByRole("timer").getAttribute("aria-label")).toMatch(/1 jam/);
    expect(screen.getByText(/Rp\s*14.000/)).toBeInTheDocument();
    expect(document.querySelector('.fsd-logo img')).toHaveAttribute("src", "/canva.png");
    fireEvent.click(screen.getByRole("button", { name: "Promo berikutnya" }));
    expect(screen.getByRole("link", { name: /Lihat paket Netflix, Private/ })).toHaveAttribute("href", "/produk/netflix");
    expect(screen.getByRole("timer").getAttribute("aria-label")).toMatch(/2 jam/);
    expect(screen.getByText(/Rp\s*24.000/)).toBeInTheDocument();
    expect(screen.getByText("Paket tersedia")).toBeInTheDocument();
  });
});
