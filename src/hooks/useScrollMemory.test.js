import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearSavedScroll,
  consumeSavedScroll,
  endCatalogRestoreLock,
  getCatalogReturnPath,
  hasSavedScrollY,
  isCatalogProductLink,
  isCatalogRestoreLocked,
  peekSavedScroll,
  saveScrollY,
  shouldSkipCatalogScrollToTop,
  slugFromCatalogProductLink,
  touchCatalogScrollY,
} from "./useScrollMemory";

describe("useScrollMemory", () => {
  beforeEach(() => {
    clearSavedScroll();
    endCatalogRestoreLock();
    Object.defineProperty(window, "scrollY", { value: 0, writable: true, configurable: true });
    Object.defineProperty(window, "location", {
      value: { search: "" },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    clearSavedScroll();
    endCatalogRestoreLock();
  });

  it("saves and peeks scroll position without consuming", () => {
    window.scrollY = 1840;
    saveScrollY({ slug: "gemini" });

    expect(hasSavedScrollY()).toBe(true);
    expect(peekSavedScroll()).toEqual(
      expect.objectContaining({ y: 1840, slug: "gemini" })
    );
    expect(hasSavedScrollY()).toBe(true);
  });

  it("reads from sessionStorage on cold start", () => {
    sessionStorage.setItem(
      "imzaqi:catalog-scroll",
      JSON.stringify({ y: 920, search: "?q=gemini", slug: "gemini", ts: 1 })
    );

    expect(peekSavedScroll()).toEqual(
      expect.objectContaining({ y: 920, slug: "gemini", search: "?q=gemini" })
    );
  });

  it("consumes saved scroll and clears storage", () => {
    window.scrollY = 500;
    saveScrollY();

    const saved = consumeSavedScroll();
    expect(saved?.y).toBe(500);
    expect(hasSavedScrollY()).toBe(false);
    expect(sessionStorage.getItem("imzaqi:catalog-scroll")).toBeNull();
  });

  it("builds catalog return path with saved search params", () => {
    Object.defineProperty(window, "location", {
      value: { search: "?sort=popular&ready=1" },
      writable: true,
      configurable: true,
    });
    window.scrollY = 100;
    saveScrollY();

    expect(getCatalogReturnPath()).toBe("/produk?sort=popular&ready=1");
  });

  it("falls back to plain catalog path when no search saved", () => {
    window.scrollY = 100;
    saveScrollY();
    expect(getCatalogReturnPath()).toBe("/produk");
  });

  it("detects product links with absolute and relative href", () => {
    expect(isCatalogProductLink("/produk/gemini")).toBe(true);
    expect(isCatalogProductLink("https://imzaqi.store/produk/gemini")).toBe(true);
    expect(isCatalogProductLink("/produk")).toBe(false);
    expect(slugFromCatalogProductLink("https://imzaqi.store/produk/gemini?x=1")).toBe("gemini");
  });

  it("updates only scroll Y while preserving slug", () => {
    saveScrollY({ slug: "gemini", y: 1000 });
    touchCatalogScrollY(2200);
    expect(peekSavedScroll()).toEqual(
      expect.objectContaining({ y: 2200, slug: "gemini" })
    );
  });

  it("does not retain the restore lock after saved scroll is cleared", () => {
    saveScrollY({ slug: "gemini", y: 900 });
    expect(shouldSkipCatalogScrollToTop()).toBe(true);
    clearSavedScroll();
    expect(isCatalogRestoreLocked()).toBe(false);
    endCatalogRestoreLock();
    expect(shouldSkipCatalogScrollToTop()).toBe(false);
  });
});
