import React from "react";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import MarketingMediaGenerator from "./MarketingMediaGenerator";
import { loadMediaImage } from "./marketingMediaExport";
import { drawProductPoster } from "./marketingMediaRenderer";

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
    fireEvent.change(screen.getByLabelText("Produk"), { target: { value: "2" } });
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
    expect(screen.getByRole("option", { name: "Design" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Kategori"), { target: { value: "design" } });
    expect(screen.getByText(/1 produk aktif/)).toBeInTheDocument();
  });
});
