import * as fc from "fast-check";
import { describe, it, expect } from "vitest";
import {
  asVariantList,
  formatGuaranteeLabel,
  getCatalogPriceRange,
  getTimeline,
  normalizeProductRecord,
  packDisplayName,
  isPromoExpired,
} from "./format";

describe("getCatalogPriceRange", () => {
  it("keeps unknown stock in the sellable pool", () => {
    const range = getCatalogPriceRange([
      { id: "a", price_idr: 22000, is_active: true },
    ]);
    expect(range.minPrice).toBe(22000);
    expect(range.inStockCount).toBe(1);
  });

  it("uses in-stock prices and ignores empty packs", () => {
    const range = getCatalogPriceRange([
      { id: "a", price_idr: 22000, stock: 0, is_active: true },
      { id: "b", price_idr: 120000, stock: 3, is_active: true },
      { id: "c", price_idr: 49600, stock: 0, is_active: true },
    ]);
    expect(range.minPrice).toBe(120000);
    expect(range.inStockCount).toBe(1);
  });

  it("applies flash sale only to the matching variant", () => {
    const flash = new Map([["c", 38]]);
    const range = getCatalogPriceRange([
      { id: "b", price_idr: 120000, stock: 3, is_active: true },
      { id: "c", price_idr: 80000, stock: 2, is_active: true },
    ], flash);
    expect(range.minPrice).toBe(Math.round(80000 * (1 - 0.38)));
  });
});

describe("formatGuaranteeLabel", () => {
  it("does not double the word Garansi", () => {
    expect(formatGuaranteeLabel("Full Garansi")).toBe("Full Garansi");
    expect(formatGuaranteeLabel("Garansi 6 Bulan")).toBe("Garansi 6 Bulan");
    expect(formatGuaranteeLabel("6 Bulan")).toBe("Garansi 6 Bulan");
  });
});

describe("packDisplayName", () => {
  it("appends duration when the pack name is generic", () => {
    const twins = [
      { name: "Gemini Pro", duration_label: "18 Bulan" },
      { name: "Gemini Pro", duration_label: "1 Tahun" },
    ];
    expect(packDisplayName(twins[0], twins)).toBe("Gemini Pro · 18 Bulan");
    expect(packDisplayName({ name: "Sharing 1 Profil 2 User", duration_label: "28 Hari" }, twins)).toBe("Sharing 1 Profil 2 User");
    expect(packDisplayName({ name: "Canva Pro (bulanan)", duration_label: "1 bulan" })).toBe("Canva Pro (bulanan)");
  });
});

describe("asVariantList", () => {
  it("returns arrays only", () => {
    expect(asVariantList([{ id: 1 }])).toEqual([{ id: 1 }]);
    expect(asVariantList(null)).toEqual([]);
    expect(asVariantList({ broken: true })).toEqual([]);
  });
});

describe("normalizeProductRecord", () => {
  it("coerces malformed variant lists", () => {
    expect(normalizeProductRecord({ id: "x", product_variants: "bad" }).product_variants).toEqual([]);
  });
});

describe("getTimeline", () => {
  it("returns cancelled flow for cancelled orders", () => {
    const steps = getTimeline("cancelled");
    expect(steps.map((s) => s.key)).toEqual(["pending", "cancelled"]);
    expect(steps[1].active).toBe(true);
    expect(steps[1].done).toBe(false);
  });

  it("marks done step complete only for done status", () => {
    const doneSteps = getTimeline("done");
    const pendingSteps = getTimeline("pending");
    expect(doneSteps.find((s) => s.key === "done")?.done).toBe(true);
    expect(pendingSteps.find((s) => s.key === "done")?.done).toBe(false);
  });

  it("always starts with pending and never returns empty timeline", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("pending", "paid_reported", "processing", "done", "cancelled", "", "unknown"),
        (status) => {
          const steps = getTimeline(status);
          expect(steps.length).toBeGreaterThanOrEqual(2);
          expect(steps[0].key).toBe("pending");
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe("isPromoExpired", () => {
  it("returns false if expired_at is null or undefined", () => {
    expect(isPromoExpired(null)).toBe(false);
    expect(isPromoExpired({})).toBe(false);
    expect(isPromoExpired({ expired_at: null })).toBe(false);
  });

  it("considers YYYY-MM-DD valid until end of day", () => {
    const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
    expect(isPromoExpired({ expired_at: today })).toBe(false);
  });

  it("marks past date as expired", () => {
    expect(isPromoExpired({ expired_at: "2020-01-01" })).toBe(true);
  });

  it("marks future date as active", () => {
    expect(isPromoExpired({ expired_at: "2099-12-31" })).toBe(false);
  });
});