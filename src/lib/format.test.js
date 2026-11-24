import * as fc from "fast-check";
import { describe, it, expect } from "vitest";
import {
  asVariantList,
  formatGuaranteeLabel,
  getCatalogPriceRange,
  getTimeline,
  normalizeProductRecord,
  packDisplayName,
  summarizeCatalogCopy,
  isPromoExpired,
  mapPromoResult,
  formatWhatsAppNumber,
  normalizeWhatsApp,
  toWhatsAppDigits,
  validateWhatsApp,
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

describe("WhatsApp Utilities", () => {
  it("normalizes Indonesian numbers to +62 format", () => {
    expect(normalizeWhatsApp("08123456789")).toBe("+628123456789");
    expect(normalizeWhatsApp("628123456789")).toBe("+628123456789");
    expect(normalizeWhatsApp("+628123456789")).toBe("+628123456789");
  });

  it("converts numbers to wa.me clean digits without leading plus", () => {
    expect(toWhatsAppDigits("08123456789")).toBe("628123456789");
    expect(toWhatsAppDigits("+628123456789")).toBe("628123456789");
    expect(toWhatsAppDigits("62812-3456-7890")).toBe("6281234567890");
    expect(toWhatsAppDigits("")).toBe("");
  });

  it("formats numbers with proper spacing and dashes", () => {
    expect(formatWhatsAppNumber("081234567890")).toBe("0812-3456-7890");
    expect(formatWhatsAppNumber("+6281234567890")).toBe("+62 812-3456-7890");
  });

  it("validates mobile numbers correctly", () => {
    expect(validateWhatsApp("08123456789").valid).toBe(true);
    expect(validateWhatsApp("81234567890").valid).toBe(true);
    expect(validateWhatsApp("+6281234567890").valid).toBe(true);
    expect(validateWhatsApp("").valid).toBe(false);
    expect(validateWhatsApp("123").valid).toBe(false);
    expect(validateWhatsApp("021123456").valid).toBe(false); // Jakarta landline not mobile
  });
});
describe("mapPromoResult (Supabase validate_promo RPC mapping)", () => {
  it("maps -1 to promo expired message", () => {
    const res = mapPromoResult(-1);
    expect(res.ok).toBe(false);
    expect(res.message).toBe("Kode promo sudah kedaluwarsa.");
  });

  it("maps -2 to already claimed message", () => {
    const res = mapPromoResult(-2);
    expect(res.ok).toBe(false);
    expect(res.message).toBe("Kamu sudah pernah menggunakan kode promo ini.");
  });

  it("maps -3 to quota exhausted message", () => {
    const res = mapPromoResult(-3);
    expect(res.ok).toBe(false);
    expect(res.message).toBe("Kuota kode promo sudah habis.");
  });

  it("maps -4 to rate limited message", () => {
    const res = mapPromoResult(-4);
    expect(res.ok).toBe(false);
    expect(res.message).toBe("Terlalu banyak percobaan kode promo. Coba lagi nanti.");
  });

  it("maps 0 to invalid/inactive code", () => {
    const res = mapPromoResult(0);
    expect(res.ok).toBe(false);
    expect(res.message).toBe("Kode tidak valid atau tidak aktif.");
  });

  it("maps positive numbers to success with discount percent", () => {
    const res = mapPromoResult(15);
    expect(res.ok).toBe(true);
    expect(res.percent).toBe(15);
    expect(res.message).toContain("15%");
  });
});

describe("summarizeCatalogCopy", () => {
  it("cleans admin shorthand and note prefixes cleanly", () => {
    expect(summarizeCatalogCopy("NOTE: wajib baca\npc admin send mail")).toBe("Kirim detail ke admin");
    expect(summarizeCatalogCopy("- akses private siap pakai")).toBe("Akses private siap pakai");
    expect(summarizeCatalogCopy("")).toBe("Pilih paket lalu lanjut ke checkout.");
  });
});
