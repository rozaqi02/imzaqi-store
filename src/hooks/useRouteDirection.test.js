import { describe, expect, test } from "vitest";
import { resolveRouteDirection } from "./useRouteDirection";

describe("resolveRouteDirection", () => {
  test("uses horizontal tab slides between main storefront destinations", () => {
    expect(resolveRouteDirection("/", "/produk")).toBe("tab-right");
    expect(resolveRouteDirection("/produk", "/faq")).toBe("tab-right");
    expect(resolveRouteDirection("/faq", "/status")).toBe("tab-right");
    expect(resolveRouteDirection("/status", "/faq")).toBe("tab-left");
    expect(resolveRouteDirection("/produk", "/")).toBe("tab-left");
  });

  test("uses push and pop for catalog drill-down to product detail", () => {
    expect(resolveRouteDirection("/produk", "/produk/canva")).toBe("push");
    expect(resolveRouteDirection("/", "/produk/netflix")).toBe("push");
    expect(resolveRouteDirection("/produk/canva", "/produk")).toBe("pop");
    expect(resolveRouteDirection("/produk/canva", "/")).toBe("pop");
  });

  test("uses calm fade for funnel and admin routes", () => {
    expect(resolveRouteDirection("/produk/canva", "/checkout")).toBe("fade");
    expect(resolveRouteDirection("/checkout", "/bayar")).toBe("fade");
    expect(resolveRouteDirection("/", "/admin")).toBe("fade");
    expect(resolveRouteDirection("/admin", "/admin/dashboard")).toBe("fade");
  });
});
