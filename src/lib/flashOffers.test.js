import { describe, expect, it } from "vitest";
import { buildFlashOffers, flashCountdown, flashPrice } from "./flashOffers";

const now = Date.parse("2026-09-29T12:00:00Z");
const sale = (variant_id, discount_percent = 25, changes = {}) => ({
  id: `${variant_id}-${discount_percent}`, variant_id, discount_percent,
  starts_at: new Date(now - 60_000).toISOString(),
  ends_at: new Date(now + 3_600_000).toISOString(),
  is_active: true, ...changes,
});
const product = (stock = 10) => ({
  id: "p1", name: "Canva", slug: "canva", is_active: true,
  product_variants: [{ id: "v1", name: "Pro", price_idr: 20000, stock, is_active: true }],
});

describe("flash offer presentation", () => {
  it("shows only live sellable offers, including stock with unknown quantity", () => {
    expect(buildFlashOffers([sale("v1")], [product(null)], now)).toMatchObject([
      { discountedPrice: 15000, saving: 5000, stock: null },
    ]);
    expect(buildFlashOffers([sale("v1")], [product(0)], now)).toEqual([]);
    expect(buildFlashOffers([sale("v1")], [{ ...product(), is_active: false }], now)).toEqual([]);
    expect(buildFlashOffers([sale("v1")], [product()], now + 3_600_000)).toEqual([]);
    expect(buildFlashOffers([sale("v1", 25, { starts_at: new Date(now + 1000).toISOString() })], [product()], now)).toEqual([]);
  });

  it("rejects invalid prices and keeps the newest active discount per variant", () => {
    expect(buildFlashOffers([sale("v1", 10), sale("v1", 35)], [product()], now)).toMatchObject([
      { discountPercent: 10, discountedPrice: 18000, saving: 2000 },
    ]);
    expect(buildFlashOffers([sale("v1")], [{ ...product(), product_variants: [{ ...product().product_variants[0], price_idr: 0 }] }], now)).toEqual([]);
    expect(buildFlashOffers([sale("v1", 100)], [product()], now)).toEqual([]);
  });

  it("formats the exact selected offer deadline and prices compactly", () => {
    expect(flashCountdown(new Date(now + 3_661_000).toISOString(), now)).toEqual([
      { label: "jam", value: 1 }, { label: "menit", value: 1 }, { label: "detik", value: 1 },
    ]);
    expect(flashCountdown(new Date(now).toISOString(), now)[0].value).toBe(0);
    expect(flashPrice(15000)).toBe("Rp 15.000");
  });
});
