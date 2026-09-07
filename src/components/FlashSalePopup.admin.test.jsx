import { act, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FlashSalePopup from "./FlashSalePopup";
import AcademicPopup from "./AcademicPopup";
import { fetchActiveFlashSales } from "../lib/api";

vi.mock("../lib/overlayScheduler", () => ({
  OVERLAY_TIMING: { flashSaleMs: 0 },
}));

vi.mock("../lib/api", () => ({
  fetchActiveFlashSales: vi.fn(async () => [
    {
      id: "s1",
      variant_id: "v1",
      discount_percent: 40,
      ends_at: new Date(Date.now() + 86400000).toISOString(),
    },
  ]),
  fetchProducts: vi.fn(async () => [
    {
      id: "p1",
      name: "Netflix",
      slug: "netflix",
      icon_url: "",
      category: "streaming",
      product_variants: [
        { id: "v1", name: "Sharing", price_idr: 25000, is_active: true, duration_label: "28 Hari" },
      ],
    },
    {
      id: "p2",
      name: "Turnitin",
      slug: "turnitin",
      icon_url: "",
      category: "academic",
      is_active: true,
      product_variants: [
        { id: "v2", name: "Cek", price_idr: 15000, is_active: true },
      ],
    },
  ]),
  fetchSettings: vi.fn(async () => ({
    academic_popup: { enabled: true },
  })),
}));

function renderPopup(ui, path) {
  return render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>, {
    container: document.getElementById("root"),
  });
}

describe("storefront popups on admin", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.body.className = "is-admin is-admin-app";
    const root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);
    window.__imzaqi_academic_popup_active = false;
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    document.body.className = "";
    window.__imzaqi_academic_popup_active = false;
  });

  it("does not open the flash-sale popup or mark #root inert on /admin/dashboard", async () => {
    renderPopup(<FlashSalePopup />, "/admin/dashboard");
    await waitFor(() => expect(fetchActiveFlashSales).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
    });
    expect(document.querySelector(".fsp-backdrop")).toBeNull();
    expect(document.getElementById("root")?.inert).toBeFalsy();
    expect(document.getElementById("root")?.getAttribute("aria-hidden")).not.toBe("true");
  });

  it("does not open the academic popup or mark #root inert on /admin", async () => {
    renderPopup(<AcademicPopup />, "/admin");
    await waitFor(() => {
      expect(document.querySelector(".ac-popup-backdrop")).toBeNull();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(document.querySelector(".ac-popup-backdrop")).toBeNull();
    expect(document.getElementById("root")?.inert).toBeFalsy();
  });

  it("still opens the flash-sale popup on the storefront", async () => {
    document.body.className = "";
    renderPopup(<FlashSalePopup />, "/");
    await waitFor(() => {
      expect(document.querySelector(".fsp-backdrop")).not.toBeNull();
    });
    expect(document.getElementById("root")?.inert).toBe(true);
  });
});
