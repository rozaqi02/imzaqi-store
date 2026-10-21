import React from "react";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import QRCode from "qrcode";
import { fetchActiveFlashSales } from "../../../lib/api";
import MarketingMediaGenerator from "./MarketingMediaGenerator";
import { loadMediaImage } from "./marketingMediaExport";
import { drawProductPoster, drawCatalogPoster } from "./marketingMediaRenderer";

const spies = vi.hoisted(() => ({ draw: vi.fn(), toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../../../context/ToastContext", () => ({ useToast: () => spies.toast }));
vi.mock("../../../lib/api", () => ({ fetchActiveFlashSales: vi.fn().mockResolvedValue([]) }));
vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn().mockResolvedValue("qr") } }));
vi.mock("./marketingMediaExport", () => ({ loadMediaImage: vi.fn(), canvasPng: vi.fn(), downloadMedia: vi.fn(), mediaZip: vi.fn() }));
vi.mock("./marketingMediaRenderer", () => ({
  drawProductPoster: vi.fn((canvas, options) => { canvas.width = 1080; canvas.height = 1080; canvas.posterName = options.offer.name; }),
  drawCatalogPoster: vi.fn((canvas) => { canvas.width = 1200; canvas.height = 1600; }),
}));

const products = [
  { id: "1", slug: "netflix", name: "Netflix", icon_url: "icon-1", category: "streaming", product_variants: [{ id: "v1", name: "Private", price_idr: 31000, stock: 5 }] },
  { id: "2", slug: "canva", name: "Canva", icon_url: "icon-2", category: "design", product_variants: [{ id: "v2", name: "Pro", price_idr: 5000, stock: 5 }] },
];
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: spies.draw });
  loadMediaImage.mockImplementation(src => Promise.resolve({ src, width: 100, height: 100 }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("marketing generator preview", () => {
  it("cannot export an empty catalogue", async () => {
    render(<MarketingMediaGenerator products={[]}/>);
    expect(screen.getByRole("button", { name: "Download PNG" })).toBeDisabled();
    expect(screen.getByText("Belum ada produk untuk ditampilkan.")).toBeInTheDocument();
    expect(drawProductPoster).not.toHaveBeenCalled();
  });
  it("does not let an older slow image overwrite the newly selected product", async () => {
    let resolveOld;
    loadMediaImage.mockImplementation(src => src === "icon-1" ? new Promise(resolve => { resolveOld = resolve; }) : Promise.resolve({ src }));
    render(<MarketingMediaGenerator products={products}/>);
    await waitFor(() => expect(resolveOld).toBeTypeOf("function"));
    fireEvent.click(screen.getByRole("combobox", { name: "Produk" }));
    fireEvent.click(screen.getByRole("option", { name: /Canva/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Download PNG" })).toBeEnabled());
    expect(spies.draw.mock.calls.at(-1)[0].posterName).toBe("Canva");
    await act(async () => { resolveOld({ src: "icon-1" }); await Promise.resolve(); });
    expect(spies.draw).toHaveBeenCalledTimes(1);
    expect(spies.draw.mock.calls.at(-1)[0].posterName).toBe("Canva");
  });
  it("supports a banner and prevents exporting an invalid manual price", async () => {
    render(<MarketingMediaGenerator products={products}/>);
    await waitFor(() => expect(screen.getByRole("button", { name: "Download PNG" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /16:9/ }));
    await waitFor(() => expect(drawProductPoster.mock.calls.at(-1)[1].format).toBe("banner"));
    fireEvent.change(screen.getByLabelText("Harga manual (Rp)"), { target: { value: "-1" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Download PNG" })).toBeDisabled());
    expect(screen.getByText("Harga manual harus berupa angka lebih dari 0.")).toBeInTheDocument();
  });
  it("includes real design categories in catalogue filtering", async () => {
    render(<MarketingMediaGenerator products={products}/>);
    fireEvent.click(screen.getByRole("button", { name: /Katalog harga/ }));
    fireEvent.click(screen.getByRole("combobox", { name: "Kategori" }));
    fireEvent.click(screen.getByRole("option", { name: /Design/ }));
    expect(screen.getByText(/1 produk aktif/)).toBeInTheDocument();
  });
  it("loads each catalogue logo from the corresponding database product", async () => {
    render(<MarketingMediaGenerator products={products}/>);
    fireEvent.click(screen.getByRole("button", { name: /Katalog harga/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Download PNG" })).toBeEnabled());
    expect(drawCatalogPoster.mock.calls.at(-1)[1].images.map(image => image.src)).toEqual(["icon-1", "icon-2"]);
  });
  it("blocks export instead of substituting an initial when a database logo fails", async () => {
    loadMediaImage.mockImplementation(src => Promise.resolve(src === "icon-1" ? null : { src }));
    render(<MarketingMediaGenerator products={products}/>);
    await waitFor(() => expect(screen.getByText(/Logo Netflix dari database gagal dimuat/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Download PNG" })).toBeDisabled();
    expect(drawProductPoster).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Coba lagi" })).toBeInTheDocument();
  });
  it("distinguishes same-name packages by duration and updates the chosen offer", async () => {
    const catalogue = [{ ...products[0], product_variants: [
      { id: "short", name: "Private", duration_label: "1 Bulan", price_idr: 31000, stock: 5 },
      { id: "long", name: "Private", duration_label: "3 Bulan", price_idr: 85000, stock: 0 },
    ] }];
    render(<MarketingMediaGenerator products={catalogue}/>);
    fireEvent.click(screen.getByRole("combobox", { name: "Paket / varian" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Cari paket / varian" }), { target: { value: "3 Bulan" } });
    const option = screen.getByRole("option", { name: /Private 3 Bulan Stok habis/ });
    fireEvent.click(option);
    await waitFor(() => expect(drawProductPoster.mock.calls.at(-1)[1].offer.price).toBe(85000));
    expect(drawProductPoster.mock.calls.at(-1)[1].offer.outOfStock).toBe(true);
  });
  it("allows switching catalogue mode to show all product variants instead of just starting price", async () => {
    const multiVariantProducts = [
      {
        id: "1",
        slug: "netflix",
        name: "Netflix",
        icon_url: "icon-1",
        category: "streaming",
        product_variants: [
          { id: "v1-1", name: "1 Bulan Private", duration_label: "30 Hari", price_idr: 31000, stock: 5 },
          { id: "v1-2", name: "3 Bulan Private", duration_label: "90 Hari", price_idr: 85000, stock: 3 },
        ],
      },
      {
        id: "2",
        slug: "canva",
        name: "Canva",
        icon_url: "icon-2",
        category: "design",
        product_variants: [
          { id: "v2-1", name: "Pro 1 Bulan", price_idr: 5000, stock: 10 },
        ],
      },
    ];
    render(<MarketingMediaGenerator products={multiVariantProducts}/>);
    fireEvent.click(screen.getByRole("button", { name: /Katalog harga/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Download PNG" })).toBeEnabled());
    expect(screen.getByText(/2 produk aktif/)).toBeInTheDocument();

    // Switch to top-level "Katalog semua varian" mode
    fireEvent.click(screen.getByRole("button", { name: /Katalog semua varian/ }));
    await waitFor(() => expect(screen.getByText(/3 paket \/ varian aktif/)).toBeInTheDocument());
    await waitFor(() => expect(drawCatalogPoster.mock.calls.at(-1)[1].catalogScope).toBe("variants"));

    const lastCall = drawCatalogPoster.mock.calls.at(-1)[1];
    expect(lastCall.products).toHaveLength(3);
    expect(lastCall.products.map(item => item.name)).toEqual(["Netflix", "Netflix", "Canva"]);
    expect(lastCall.products.map(item => item.offer.variant)).toEqual([
      "1 Bulan Private",
      "3 Bulan Private",
      "Pro 1 Bulan",
    ]);

    // Test product-level filter within variants mode
    fireEvent.click(screen.getByRole("combobox", { name: "Filter produk (opsional)" }));
    fireEvent.click(screen.getByRole("option", { name: /Netflix/ }));
    await waitFor(() => expect(screen.getByText(/2 paket \/ varian aktif/)).toBeInTheDocument());
    await waitFor(() => expect(drawCatalogPoster.mock.calls.at(-1)[1].products).toHaveLength(2));
    const filteredCall = drawCatalogPoster.mock.calls.at(-1)[1];
    expect(filteredCall.products.map(item => item.offer.variant)).toEqual([
      "1 Bulan Private",
      "3 Bulan Private",
    ]);
  });
  it("filters products and variants by ready stock and active status", async () => {
    const stockTestProducts = [
      {
        id: "1",
        slug: "netflix",
        name: "Netflix",
        icon_url: "icon-1",
        is_active: true,
        product_variants: [
          { id: "v1-in", name: "In Stock", duration_label: "1 Bulan", price_idr: 30000, stock: 4, is_active: true },
          { id: "v1-out", name: "Out of Stock", duration_label: "3 Bulan", price_idr: 80000, stock: 0, is_active: true },
        ],
      },
      {
        id: "2",
        slug: "spotify",
        name: "Spotify",
        icon_url: "icon-2",
        is_active: false,
        product_variants: [
          { id: "v2-in", name: "Family", duration_label: "1 Bulan", price_idr: 20000, stock: 2, is_active: true },
        ],
      },
    ];
    render(<MarketingMediaGenerator products={stockTestProducts}/>);
    fireEvent.click(screen.getByRole("button", { name: /Katalog semua varian/ }));
    await waitFor(() => expect(screen.getByText(/2 paket \/ varian aktif/)).toBeInTheDocument());

    // Toggle "Hanya ready stok"
    const inStockCheckbox = screen.getByRole("checkbox", { name: /Hanya ready stok/ });
    fireEvent.click(inStockCheckbox);
    await waitFor(() => expect(screen.getByText(/1 paket \/ varian ready stok/)).toBeInTheDocument());
    await waitFor(() => expect(drawCatalogPoster.mock.calls.at(-1)[1].products).toHaveLength(1));
    expect(drawCatalogPoster.mock.calls.at(-1)[1].products[0].offer.variant).toBe("In Stock");

    // Toggle off "Hanya produk aktif" to show inactive products
    const activeCheckbox = screen.getByRole("checkbox", { name: /Hanya produk aktif/ });
    fireEvent.click(activeCheckbox);
    await waitFor(() => expect(screen.getByText(/2 paket \/ varian ready stok/)).toBeInTheDocument());
    await waitFor(() => expect(drawCatalogPoster.mock.calls.at(-1)[1].products).toHaveLength(2));
    expect(drawCatalogPoster.mock.calls.at(-1)[1].products.map(p => p.name)).toEqual(["Netflix", "Spotify"]);

    // Toggle on "Harga reseller (15%)"
    const resellerCheckbox = screen.getByRole("checkbox", { name: /harga reseller \(15%\)/i });
    fireEvent.click(resellerCheckbox);
    await waitFor(() => expect(drawCatalogPoster.mock.calls.at(-1)[1].products[0].offer.price).toBe(34500)); // 30000 * 1.15 = 34500
    expect(drawCatalogPoster.mock.calls.at(-1)[1].products[1].offer.price).toBe(23000); // 20000 * 1.15 = 23000
  });

  it("toggles flash sale prices on and off using the flash sale checkbox", async () => {
    const flashSaleProducts = [
      {
        id: "p-sale",
        slug: "chatgpt",
        name: "ChatGPT Plus",
        icon_url: "icon-gpt",
        product_variants: [
          { id: "v-sale", name: "1 Bulan", price_idr: 100000, stock: 10, is_active: true },
        ],
      },
    ];
    fetchActiveFlashSales.mockResolvedValueOnce([
      {
        variant_id: "v-sale",
        discount_percent: 25,
        starts_at: "2020-01-01T00:00:00Z",
        ends_at: "2030-01-01T00:00:00Z",
        is_active: true,
      },
    ]);

    render(<MarketingMediaGenerator products={flashSaleProducts}/>);
    await waitFor(() => expect(screen.getByRole("button", { name: "Download PNG" })).toBeEnabled());

    // By default, flash sale is enabled: 100000 - 25% = 75000
    await waitFor(() => expect(drawProductPoster.mock.calls.at(-1)[1].offer.price).toBe(75000));
    expect(drawProductPoster.mock.calls.at(-1)[1].offer.original).toBe(100000);

    // Toggle off "Tampilkan harga flash sale jika ada"
    const fsCheckbox = screen.getByRole("checkbox", { name: /tampilkan harga flash sale jika ada/i });
    fireEvent.click(fsCheckbox);

    // Should now show regular price: 100000
    await waitFor(() => expect(drawProductPoster.mock.calls.at(-1)[1].offer.price).toBe(100000));
    expect(drawProductPoster.mock.calls.at(-1)[1].offer.original).toBe(0);

    // Toggle back on
    fireEvent.click(fsCheckbox);
    await waitFor(() => expect(drawProductPoster.mock.calls.at(-1)[1].offer.price).toBe(75000));
  });

  it("supports custom reseller markup per variant (e.g. +30% for Gemini)", async () => {
    const testProducts = [
      {
        id: "p-gemini",
        slug: "gemini",
        name: "Gemini AI",
        icon_url: "icon-gemini",
        product_variants: [
          { id: "v-gem", name: "Advanced 1 Bulan", price_idr: 100000, stock: 5, is_active: true },
        ],
      },
    ];

    render(<MarketingMediaGenerator products={testProducts}/>);
    await waitFor(() => expect(screen.getByRole("button", { name: "Download PNG" })).toBeEnabled());

    // Enable reseller price (+15% default) -> 100000 * 1.15 = 115000
    const resellerCheckbox = screen.getByRole("checkbox", { name: /harga reseller \(15%\)/i });
    fireEvent.click(resellerCheckbox);
    await waitFor(() => expect(drawProductPoster.mock.calls.at(-1)[1].offer.price).toBe(115000));

    // Custom markup input inside the custom markups panel
    expect(screen.getByText(/Custom markup reseller per varian \/ produk/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Pilih produk"), { target: { value: "p-gemini" } });
    fireEvent.change(screen.getByLabelText("Markup (%)"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Terapkan" }));

    // Price should now be 100000 * 1.30 = 130000 (+30%)
    await waitFor(() => expect(drawProductPoster.mock.calls.at(-1)[1].offer.price).toBe(130000));
    expect(screen.getByText(/Gemini AI \(Semua varian\): \+30%/)).toBeInTheDocument();

    // In single poster mode, admin can also edit markup directly in customizer
    fireEvent.click(screen.getByText("Ubah teks & harga"));
    const singleMarkupInput = screen.getByLabelText("Markup reseller varian ini (%)");
    expect(singleMarkupInput).toHaveValue(30);

    // Change to 40%
    fireEvent.change(singleMarkupInput, { target: { value: "40" } });
    await waitFor(() => expect(drawProductPoster.mock.calls.at(-1)[1].offer.price).toBe(140000));
  });

  it("switches footer to reseller mode and updates QR code with custom WhatsApp number", async () => {
    render(<MarketingMediaGenerator products={products}/>);
    await waitFor(() => expect(screen.getByRole("button", { name: "Download PNG" })).toBeEnabled());

    // Default footer is standard: QR code points to product/catalog URL
    await waitFor(() => expect(QRCode.toDataURL).toHaveBeenCalledWith(expect.stringContaining("imzaqi.store"), expect.any(Object)));
    expect(drawProductPoster.mock.calls.at(-1)[1].footerMode).toBe("standard");

    // Switch footer to "Khusus Reseller"
    const resellerFooterBtn = screen.getByRole("button", { name: /Khusus Reseller/i });
    fireEvent.click(resellerFooterBtn);

    // QR should point to default reseller WA: https://wa.me/6285899508251
    await waitFor(() => expect(QRCode.toDataURL).toHaveBeenCalledWith("https://wa.me/6285899508251", expect.any(Object)));
    expect(drawProductPoster.mock.calls.at(-1)[1].footerMode).toBe("reseller");

    // Custom phone number input
    const phoneInput = screen.getByLabelText(/Nomor WhatsApp Reseller/i);
    expect(phoneInput).toHaveValue("+62 858-9950-8251");

    // Change phone number to a custom number
    fireEvent.change(phoneInput, { target: { value: "0812-9876-5432" } });
    await waitFor(() => expect(QRCode.toDataURL).toHaveBeenCalledWith("https://wa.me/6281298765432", expect.any(Object)));
  });
});
