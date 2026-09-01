import { describe, expect, test } from "vitest";
import { getAdminNavTarget, isNavItemActive, SITE_BOTTOM_NAV } from "./siteNav";

describe("siteNav", () => {
  test("keeps the compact navigation at four primary routes", () => {
    const paths = SITE_BOTTOM_NAV.map((item) => item.to);
    expect(paths).toEqual(["/", "/produk", "/testimoni", "/status"]);
  });

  test("getAdminNavTarget points to dashboard or login", () => {
    expect(getAdminNavTarget(true)).toBe("/admin/dashboard");
    expect(getAdminNavTarget(false)).toBe("/admin");
  });

  test("isNavItemActive matches nested catalog and status routes", () => {
    expect(isNavItemActive("/", "/")).toBe(true);
    expect(isNavItemActive("/produk", "/")).toBe(false);
    expect(isNavItemActive("/produk/netflix", "/produk")).toBe(true);
    expect(isNavItemActive("/status", "/status")).toBe(true);
    expect(isNavItemActive("/status?tab=riwayat", "/status")).toBe(false);
  });
});
