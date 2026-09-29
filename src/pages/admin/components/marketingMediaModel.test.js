import { describe, it, expect } from "vitest";
import { chooseVariant, liveDiscounts, posterOffer, paginateCatalog, normalizeMediaPhone } from "./marketingMediaModel";
import { mediaZip } from "./marketingMediaExport";

const product = { name: "Netflix Premium", slug: "netflix", product_variants: [
  { id: "sold-out", price_idr: 25000, stock: 0, is_active: true },
  { id: "ready", name: "Private", price_idr: 31000, duration_label: "1 Bulan", guarantee_text: "1 Bulan", stock: 16, is_active: true },
  { id: "inactive", price_idr: 1000, stock: 10, is_active: false },
] };

describe("marketing product offers", () => {
  it("chooses a sellable package and still allows an explicit sold-out choice", () => {
    expect(chooseVariant(product)?.id).toBe("ready");
    const sold = chooseVariant(product, "sold-out");
    expect(posterOffer(product, sold).outOfStock).toBe(true);
  });
  it("uses real flash-sale prices and drops expired / upcoming sales", () => {
    const now = Date.parse("2026-09-29T10:00:00Z");
    const map = liveDiscounts([
      { variant_id: "ready", discount_percent: 20, starts_at: "2026-09-29T09:00:00Z", ends_at: "2026-09-29T11:00:00Z" },
      { variant_id: "sold-out", discount_percent: 15, starts_at: "2026-09-29T09:00:00Z", ends_at: "2026-09-29T10:00:00Z" },
      { variant_id: "future", discount_percent: 20, starts_at: "2026-09-29T12:00:00Z", ends_at: "2026-09-29T13:00:00Z" },
    ], now);
    expect(map.size).toBe(1);
    expect(posterOffer(product, chooseVariant(product), map)).toMatchObject({ price: 24800, original: 31000, discount: 20, guarantee: "1 Bulan" });
  });
  it("never invents a discount, guarantee or price for incomplete products", () => {
    expect(posterOffer(product, chooseVariant(product))).toMatchObject({ price: 31000, original: 0, discount: 0 });
    expect(posterOffer({ name: "Custom service" }, null)).toMatchObject({ price: 0, original: 0, guarantee: "" });
  });
  it("accepts a manual price, rejects invalid prices and preserves zero-input errors", () => {
    const variant = chooseVariant(product);
    expect(posterOffer(product, variant, undefined, { price: "29000" }).price).toBe(29000);
    for (const price of ["0", "-1", "abc"]) expect(() => posterOffer(product, variant, undefined, { price })).toThrow();
  });
  it("paginates a large catalogue without dropping products", () => {
    const items = Array.from({ length: 27 }, (_, id) => ({ id }));
    const pages = paginateCatalog(items);
    expect(pages.map(page => page.length)).toEqual([10, 10, 7]);
    expect(pages.flat()).toEqual(items);
    expect(paginateCatalog([])).toEqual([]);
  });
  it("normalizes a local admin number for the poster", () => {
    expect(normalizeMediaPhone("0812-3274-2374")).toBe("6281232742374");
  });
});

describe("catalogue ZIP export", () => {
  it("writes a valid directory with original bytes, CRC and both page names", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    // The browser Blob in jsdom omits arrayBuffer; use the native Node Blob.
    const { Blob } = await import("node:buffer");
    const zip = await mediaZip([{ name: "page-1.png", blob: new Blob([bytes]) }, { name: "page-2.png", blob: new Blob([bytes]) }]);
    const data = new Uint8Array(await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsArrayBuffer(zip); }));
    const view = new DataView(data.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(14, true)).toBe(0xb63cfbcd);
    const end = data.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
    const directory = view.getUint32(end + 16, true);
    expect(view.getUint32(directory, true)).toBe(0x02014b50);
    expect(new TextDecoder().decode(data)).toContain("page-2.png");
  });
});
