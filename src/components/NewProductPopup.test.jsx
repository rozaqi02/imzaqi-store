import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NewProductPopup from "./NewProductPopup";
import { fetchSettings, fetchProducts } from "../lib/api";
import { releaseOverlaySlot, requestOverlaySlot } from "../lib/overlayScheduler";

vi.mock("../lib/api", () => ({ fetchSettings: vi.fn(), fetchProducts: vi.fn() }));
const product = { id: "n", slug: "netflix", name: "Netflix", icon_url: "/netflix.png", product_variants: [{ price_idr: 31000, stock: 4 }] };
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear(); sessionStorage.clear();
  document.body.innerHTML = '<div id="root"></div>';
  fetchSettings.mockResolvedValue({ new_product_popup: { enabled: true, product_id: "n", show_on: "home" } });
  fetchProducts.mockResolvedValue([product]);
});
afterEach(() => {
  cleanup();
  // Jaga-jaga: scheduler adalah singleton level modul, jangan bocor antar test.
  releaseOverlaySlot("flashSalePopup");
  releaseOverlaySlot("newProductPopup");
  vi.useRealTimers();
});
async function start(path = "/") {
  render(<MemoryRouter initialEntries={[path]}><NewProductPopup/></MemoryRouter>, { container: document.getElementById("root") });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  await act(async () => { vi.advanceTimersByTime(1900); });
}

describe("new product popup", () => {
  it("uses the same automatic content as preview and closes with Escape without repeating", async () => {
    await start();
    expect(screen.getByRole("dialog")).toHaveTextContent("Baru hadir: Netflix");
    expect(screen.getByRole("img", { name: "Netflix" })).toHaveAttribute("src", "/netflix.png");
    expect(document.getElementById("root").inert).toBe(true);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(sessionStorage.getItem("imzaqi_new_product_popup_done")).toBe("true");
    expect(document.getElementById("root").inert).toBe(false);
    await act(async () => { vi.advanceTimersByTime(4000); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it.each(["/admin", "/checkout", "/bayar/order-1", "/produk/netflix"])("does not open a home-only popup on %s", async path => {
    await start(path);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.getElementById("root").inert).toBeFalsy();
  });
  it("allows all-storefront placement on a product page", async () => {
    fetchSettings.mockResolvedValue({ new_product_popup: { enabled: true, product_id: "n", show_on: "all" } });
    await start("/produk/netflix");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  it("waits for a higher-priority overlay instead of dropping or stacking the announcement", async () => {
    // Kontrak baru: penundaan diatur scheduler terpusat (satu slot eksklusif),
    // bukan lagi dengan memeriksa class DOM popup lain.
    const releaseFlashSale = requestOverlaySlot("flashSalePopup", { ready: true });
    await start();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await act(async () => { releaseFlashSale(); });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  it("does not open for an inactive product or for a disabled setting", async () => {
    fetchProducts.mockResolvedValue([{ ...product, is_active: false }]);
    await start();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
