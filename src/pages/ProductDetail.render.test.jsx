import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
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
}));

vi.mock("../context/ToastContext", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
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