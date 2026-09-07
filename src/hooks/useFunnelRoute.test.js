import { describe, expect, it } from "vitest";
import { isAdminPath, isFunnelPath, isStorefrontOverlayBlocked } from "./useFunnelRoute";

describe("storefront overlay blocking", () => {
  it("treats checkout and pay as funnel paths", () => {
    expect(isFunnelPath("/checkout")).toBe(true);
    expect(isFunnelPath("/checkout/x")).toBe(true);
    expect(isFunnelPath("/bayar")).toBe(true);
    expect(isFunnelPath("/produk")).toBe(false);
  });

  it("treats login and dashboard as admin paths", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/dashboard")).toBe(true);
    expect(isAdminPath("/admin/dashboard/orders")).toBe(true);
    expect(isAdminPath("/administrator")).toBe(false);
    expect(isAdminPath("/")).toBe(false);
  });

  it("blocks storefront overlays on funnel and admin, not catalog", () => {
    expect(isStorefrontOverlayBlocked("/admin")).toBe(true);
    expect(isStorefrontOverlayBlocked("/admin/dashboard")).toBe(true);
    expect(isStorefrontOverlayBlocked("/checkout")).toBe(true);
    expect(isStorefrontOverlayBlocked("/bayar")).toBe(true);
    expect(isStorefrontOverlayBlocked("/")).toBe(false);
    expect(isStorefrontOverlayBlocked("/produk")).toBe(false);
  });
});
