import { describe, it, expect, vi } from "vitest";
import { drawCatalogPoster, drawProductPoster } from "./marketingMediaRenderer";

function createMockCanvas() {
  const calls = [];
  const fills = [];
  const strokes = [];
  const ctx = {
    font: "",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    textAlign: "left",
    textBaseline: "alphabetic",
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn((x, y) => calls.push({ type: "moveTo", x, y })),
    lineTo: vi.fn((x, y) => calls.push({ type: "lineTo", x, y })),
    arc: vi.fn(),
    arcTo: vi.fn(),
    ellipse: vi.fn(),
    fillRect: vi.fn(),
    stroke: vi.fn(() => strokes.push(ctx.strokeStyle)),
    fill: vi.fn(),
    rotate: vi.fn(),
    translate: vi.fn(),
    drawImage: vi.fn(),
    measureText: vi.fn(text => ({ width: String(text).length * 10 })),
    fillText: vi.fn((text, x, y) => {
      fills.push({ text, x, y, fillStyle: ctx.fillStyle, font: ctx.font });
    }),
  };
  return {
    width: 1200,
    height: 1600,
    getContext: () => ctx,
    ctx,
    fills,
    strokes,
  };
}

describe("marketingMediaRenderer flash sale pricing", () => {
  it("renders discounted price in red and places original strikethrough price without overlap", () => {
    const canvas = createMockCanvas();
    const mockProducts = [
      {
        id: "1",
        name: "Gemini AI Pro",
        icon_url: "icon-gemini",
        variant: { id: "v1", name: "18 Bulan" },
        offer: {
          name: "Gemini AI Pro",
          variant: "Gemini Pro",
          duration: "18 Bulan",
          price: 52440,
          original: 138000,
          outOfStock: false,
        },
      },
    ];

    drawCatalogPoster(canvas, {
      products: mockProducts,
      discounts: new Map(),
      theme: "emerald",
      page: 1,
      pageCount: 1,
      total: 1,
      images: [null],
      qr: null,
      catalogScope: "variants",
    });

    // Check that the discounted price is drawn in red
    const priceFill = canvas.fills.find(f => f.text.includes("52.440"));
    expect(priceFill).toBeDefined();
    expect(priceFill.fillStyle).toBe("#d92d20");

    // Check that the original price is drawn after the discounted price with strikethrough
    const origFill = canvas.fills.find(f => f.text.includes("138.000"));
    expect(origFill).toBeDefined();

    // Verify origFill.x is to the right of priceFill.x + price text width
    expect(origFill.x).toBeGreaterThan(priceFill.x);
    // There must be a gap of at least 10px beyond the measured text width
    expect(origFill.x - priceFill.x).toBeGreaterThanOrEqual(priceFill.text.length * 10);
  });

  it("renders standard price in ink color when there is no flash sale discount", () => {
    const canvas = createMockCanvas();
    const mockProducts = [
      {
        id: "1",
        name: "Prime Video",
        icon_url: "icon-prime",
        variant: { id: "v1", name: "1 Bulan" },
        offer: {
          name: "Prime Video",
          variant: "Sharing",
          duration: "1 Bulan",
          price: 14950,
          original: 0,
          outOfStock: false,
        },
      },
    ];

    drawCatalogPoster(canvas, {
      products: mockProducts,
      discounts: new Map(),
      theme: "emerald",
      page: 1,
      pageCount: 1,
      total: 1,
      images: [null],
      qr: null,
      catalogScope: "variants",
    });

    const priceFill = canvas.fills.find(f => f.text.includes("14.950"));
    expect(priceFill).toBeDefined();
    expect(priceFill.fillStyle).toBe("#143f32"); // emerald ink
    const origFill = canvas.fills.find(f => f.text.includes("original"));
    expect(origFill).toBeUndefined();
  });

  it("renders single product poster price in red when on flash sale", () => {
    const canvas = createMockCanvas();
    const offer = {
      name: "Gemini AI Pro",
      variant: "18 Bulan",
      duration: "18 Bulan",
      price: 52440,
      original: 138000,
      outOfStock: false,
    };

    drawProductPoster(canvas, {
      offer,
      styleId: "best_seller",
      format: "square",
    });

    const priceFill = canvas.fills.find(f => f.text.includes("52.440"));
    expect(priceFill).toBeDefined();
    expect(priceFill.fillStyle).toBe("#d92d20");
  });
});
