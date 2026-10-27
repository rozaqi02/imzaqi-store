import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Promosi from "./Promosi";

// Mock fetch APIs
vi.mock("../lib/api", () => ({
  fetchProducts: vi.fn(),
  fetchSettings: vi.fn(),
  fetchActiveFlashSales: vi.fn(() => Promise.resolve([])),
}));

// Mock ToastContext
vi.mock("../context/ToastContext", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

// Mock page meta hook
vi.mock("../hooks/usePageMeta", () => ({
  usePageMeta: vi.fn(),
}));

import { fetchProducts, fetchSettings } from "../lib/api";

const mockProducts = [
  {
    id: "p1",
    name: "Netflix Premium",
    slug: "netflix-premium",
    icon_url: "https://example.com/netflix.png",
    product_variants: [
      { id: "v1", name: "1 Bulan Private", price: 35000, is_active: true, stock: 10 },
    ],
  },
];

describe("Promosi Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state initially, then loads products and 3-step guide", async () => {
    fetchProducts.mockResolvedValueOnce(mockProducts);
    fetchSettings.mockResolvedValueOnce({ store_phone: "08123456789" });

    render(<Promosi />);

    expect(screen.getByText("STUDIO PROMOSI & RESELLER")).toBeInTheDocument();
    expect(screen.getByText("PANDUAN 3 LANGKAH STUDIO")).toBeInTheDocument();
    expect(screen.getByText("Pilih Mode Materi")).toBeInTheDocument();
    expect(screen.getByText("Kustomisasi Desain")).toBeInTheDocument();
    expect(screen.getByText("Unduh & Bagikan")).toBeInTheDocument();

    // While loading
    expect(screen.getByText("Menyiapkan data produk & katalog resmi...")).toBeInTheDocument();

    // After loading
    await waitFor(() => {
      expect(screen.queryByText("Menyiapkan data produk & katalog resmi...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Kustomisasi Materi Promosi")).toBeInTheDocument();
    const facts = screen.getByLabelText("Ringkasan studio promosi");
    expect(within(facts).getByText(/produk aktif/)).toBeInTheDocument();
  });

  it("resiliently loads products even if fetchSettings fails", async () => {
    fetchProducts.mockResolvedValueOnce(mockProducts);
    fetchSettings.mockRejectedValueOnce(new Error("Network timeout"));

    render(<Promosi />);

    await waitFor(() => {
      expect(screen.queryByText("Menyiapkan data produk & katalog resmi...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Kustomisasi Materi Promosi")).toBeInTheDocument();
    const facts = screen.getByLabelText("Ringkasan studio promosi");
    expect(within(facts).getByText(/produk aktif/)).toBeInTheDocument();
  });
});
