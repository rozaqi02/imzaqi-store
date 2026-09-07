import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import ProductDetail from "./ProductDetail";

const mockProduct = {
  id: "b59a466b-2016-4f4e-b553-0184a0d36aa9",
  slug: "netflix",
  name: "Netflix Premium",
  description: "1 Akun netflix ada 5 profil",
  icon_url: "https://example.com/icon.jpg",
  product_variants: [
    {
      id: "7ac114be-96c5-47dd-838c-54fb9f951165",
      name: "Sharing 1 Profil 1 User",
      price_idr: 28000,
      stock: 4,
      is_active: true,
      sort_order: 30,
      duration_label: "28 Hari",
      guarantee_text: "Garansi 14 Hari",
      requires_buyer_email: false,
      description: "Benefit:\n\n- Full HD",
      sold_count: 2,
    },
    {
      id: "48b2b78f-e34e-4f18-a395-7e4888d2b853",
      name: "Sharing 1 Profil 2 User",
      price_idr: 25000,
      stock: 11,
      is_active: true,
      sort_order: 20,
      duration_label: "28 Hari",
      guarantee_text: "Full Garansi",
      requires_buyer_email: false,
      description: "Benefit:\n\n- Sharing",
      sold_count: 11,
    },
  ],
};

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ state: null, pathname: "/produk/netflix-premium" }),
  };
});

vi.mock("../lib/api", () => ({
  fetchProductBySlug: vi.fn(() => Promise.resolve(mockProduct)),
  fetchActiveFlashSales: vi.fn(() => Promise.resolve([])),
  fetchProducts: vi.fn(() => Promise.resolve([mockProduct])),
  fetchTopSellingData: vi.fn(() => Promise.resolve({ topIds: [], salesMap: {} })),
}));

vi.mock("../context/ToastContext", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

vi.mock("../context/CartContext", () => ({
  useCart: () => ({ items: [], add: vi.fn() }),
}));

vi.mock("../hooks/usePageMeta", () => ({ usePageMeta: vi.fn() }));
vi.mock("../hooks/useAdaptiveMotion", () => ({ useAdaptiveMotion: () => "full" }));
vi.mock("../hooks/usePerformanceMonitor", () => ({ useLongTaskMonitor: vi.fn() }));
vi.mock("../hooks/useIsMobile", () => ({
  useDeviceCapability: () => ({
    isMobile: false,
    isReducedMotion: false,
    saveData: false,
    lowMemory: false,
  }),
}));

vi.mock("../components/Confetti", () => ({ fireConfetti: vi.fn() }));
vi.mock("../lib/cartFlyParticle", () => ({ spawnCartFlyParticle: vi.fn() }));

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={["/produk/netflix"]}>
      <Routes>
        <Route path="/produk/:slug" element={<ProductDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ProductDetail render", () => {
  it("renders product without crashing", async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText("Netflix Premium")).toBeInTheDocument();
    });
  });

  it("sorts variant cards from the filter chips", async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText("Netflix Premium")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Rekomendasi" })).toBeInTheDocument();
    const cheapest = await screen.findByRole("button", { name: "Termurah" });
    fireEvent.click(cheapest);

    expect(cheapest).toHaveAttribute("aria-pressed", "true");
    const packNames = [...document.querySelectorAll(".pdx-packName")].map((el) => el.textContent);
    expect(packNames[0]).toBe("Sharing 1 Profil 2 User");
  });

  it("sorts Termurah by price even if the cheapest pack is out of stock", async () => {
    const { fetchProductBySlug } = await import("../lib/api");
    fetchProductBySlug.mockResolvedValueOnce({
      ...mockProduct,
      product_variants: [
        { ...mockProduct.product_variants[0], price_idr: 120000, stock: 3, sold_count: 20, name: "Gemini Pro" },
        { ...mockProduct.product_variants[1], price_idr: 22000, stock: 0, sold_count: 1, name: "Gemini 1 Bulan" },
      ],
    });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText("Netflix Premium")).toBeInTheDocument();
    });
    fireEvent.click(await screen.findByRole("button", { name: "Termurah" }));
    const packNames = [...document.querySelectorAll(".pdx-packName")].map((el) => el.textContent);
    expect(packNames[0]).toBe("Gemini 1 Bulan");
  });

  it("shows Bandingkan paket on the compare button", async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText("Netflix Premium")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Bandingkan paket" })).toBeInTheDocument();
  });

  it("links Hubungi Admin to the premium WhatsApp number with a prefilled message", async () => {
    renderDetail();
    const contact = await screen.findByRole("link", { name: "Hubungi Admin" });
    expect(contact).toHaveAttribute("href", expect.stringContaining("https://wa.me/6283136049987?text="));
    expect(decodeURIComponent(contact.getAttribute("href"))).toContain("Netflix Premium");
    expect(decodeURIComponent(contact.getAttribute("href"))).toContain("App Premium");
  });

  it("links Hubungi Admin to the academic WhatsApp number for jasa akademik", async () => {
    const { fetchProductBySlug } = await import("../lib/api");
    fetchProductBySlug.mockResolvedValueOnce({
      ...mockProduct,
      name: "Turnitin Check",
      slug: "turnitin-check",
      category: "academic",
    });
    renderDetail();
    const contact = await screen.findByRole("link", { name: "Hubungi Admin" });
    expect(contact.getAttribute("href")).toContain("https://wa.me/6281232742374?text=");
    expect(decodeURIComponent(contact.getAttribute("href"))).toContain("Jasa Akademik");
    expect(decodeURIComponent(contact.getAttribute("href"))).toContain("Turnitin Check");
  });

  it("labels the top-selling pack as Paling Laris instead of a cheapest-pack fake", async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText("Netflix Premium")).toBeInTheDocument();
    });
    expect(screen.getByText("Paling Laris")).toBeInTheDocument();
    expect(screen.queryByText("Paling hemat")).not.toBeInTheDocument();
  });

  it("shows Paling hemat on the cheapest pack when another pack is terlaris", async () => {
    const { fetchProductBySlug } = await import("../lib/api");
    fetchProductBySlug.mockResolvedValueOnce({
      ...mockProduct,
      product_variants: [
        { ...mockProduct.product_variants[0], price_idr: 18000, sold_count: 1, stock: 8 },
        { ...mockProduct.product_variants[1], price_idr: 32000, sold_count: 18, stock: 6 },
      ],
    });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText("Netflix Premium")).toBeInTheDocument();
    });
    expect(screen.getByText("Paling Laris")).toBeInTheDocument();
    expect(screen.getByText("Paling hemat")).toBeInTheDocument();
  });

  it("shows a skeleton while the product is loading", async () => {
    const { fetchProductBySlug } = await import("../lib/api");
    let resolveProduct;
    fetchProductBySlug.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveProduct = resolve;
      })
    );

    renderDetail();
    expect(document.querySelector(".pdx-skeletonGrid")).toBeTruthy();
    expect(document.querySelector(".detail-page-v3")).toHaveAttribute("aria-busy", "true");

    resolveProduct(mockProduct);
    await waitFor(() => {
      expect(screen.getByText("Netflix Premium")).toBeInTheDocument();
    });
    expect(document.querySelector(".pdx-skeletonGrid")).toBeNull();
  });

  it("survives malformed product_variants cache shape", async () => {
    const { fetchProductBySlug } = await import("../lib/api");
    fetchProductBySlug.mockResolvedValueOnce({
      ...mockProduct,
      product_variants: { broken: true },
    });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText("Netflix Premium")).toBeInTheDocument();
      expect(screen.getByText("Belum ada paket")).toBeInTheDocument();
    });
  });
});