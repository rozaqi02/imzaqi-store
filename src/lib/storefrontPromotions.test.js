import { describe, expect, it } from "vitest";
import { normalizePromotion, isPromotionLinkValid, promotionDestination, readyFlashPromotions, resolveBannerCopy, resolvePromotionCopy, validatePromotion } from "./storefrontPromotions";

describe("storefront promotion rules", () => {
  it("defaults to disabled and falls back for old invalid enum values", () => {
    expect(normalizePromotion("new_product_popup", { enabled: "true", show_on: "somewhere" })).toMatchObject({ enabled: false, show_on: "home" });
    expect(normalizePromotion("new_product_banner", { color: "invalid_color" }).color).toBe("green");
    expect(normalizePromotion("service_banner", { color: "invalid" })).toMatchObject({ enabled: false, color: "green", text: "Proses 5–30 menit · Garansi replace · Checkout QRIS" });
  });
  it("supports local paths and web links, rejects unsafe or ambiguous destinations", () => {
    for (const link of ["", "/produk/netflix", "https://imzaqi.store/produk", "http://localhost:3000/produk"]) expect(isPromotionLinkValid(link)).toBe(true);
    for (const link of ["javascript:alert(1)", "//evil.test", "data:text/html,test", "example.com", "/\\evil.test", "https://bad url"]) expect(isPromotionLinkValid(link)).toBe(false);
    expect(promotionDestination("javascript:alert(1)", { slug: "netflix" })).toBe("/produk/netflix");
  });
  it("uses sellable variant prices for the same automatic copy in preview and storefront", () => {
    const product = { name: "Netflix", slug: "netflix", product_variants: [{ price_idr: 5000, stock: 0 }, { price_idr: 31000, stock: 2 }, { price_idr: 1000, is_active: false }] };
    expect(resolvePromotionCopy(normalizePromotion("new_product_popup"), product)).toMatchObject({ title: "Baru hadir: Netflix", price: 31000, link: "/produk/netflix" });
  });
  it("only counts live sales for active, available catalogue packages", () => {
    const now = Date.parse("2026-09-29T12:00:00Z");
    const live = { variant_id: "v", starts_at: "2026-09-29T11:00:00Z", ends_at: "2026-09-29T13:00:00Z", discount_percent: 15 };
    const products = [{ product_variants: [{ id: "v", stock: 3 }, { id: "empty", stock: 0 }] }];
    const sales = [live, { ...live, starts_at: "invalid" }, { ...live, starts_at: "2026-09-29T12:01:00Z" }, { ...live, ends_at: "2026-09-29T12:00:00Z" }, { ...live, variant_id: "empty" }, { ...live, is_active: false }];
    expect(readyFlashPromotions(sales, products, now)).toEqual([live]);
  });
  it("keeps old custom banners and resolves automatic banner types from current catalog data", () => {
    expect(normalizePromotion("new_product_banner", { enabled: true, text: "Toko buka" }).type).toBe("custom");
    const now = Date.parse("2026-09-29T12:00:00Z");
    const products = [
      { id: "a", name: "Jasa Parafrase", slug: "parafrase", category: "academic", product_variants: [{ id: "va", stock: 2 }] },
      { id: "b", name: "Netflix", slug: "netflix", category: "streaming", product_variants: [{ id: "vb", stock: 2 }] },
    ];
    const sales = [{ variant_id: "vb", starts_at: "2026-09-29T11:00:00Z", ends_at: "2026-09-29T13:00:00Z", discount_percent: 25 }];
    expect(resolveBannerCopy({ type: "flash", badge: "" }, products, sales, now)).toMatchObject({ available: true, text: "Flash sale Netflix · -25%", link: "/produk/netflix" });
    expect(resolveBannerCopy({ type: "flash" }, products, sales, now + 3600001).available).toBe(false);
    expect(resolveBannerCopy({ type: "academic", badge: "" }, products)).toMatchObject({ available: true, link: "/produk/parafrase" });
    expect(validatePromotion("new_product_banner", { enabled: true, type: "custom", text: "" }, products)).toHaveProperty("text");
  });
});
