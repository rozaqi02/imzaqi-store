import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import AbandonedCartBanner from "./AbandonedCartBanner";
import * as cartReminder from "../lib/cartReminder";

vi.mock("../hooks/useFunnelRoute", () => ({
  useStorefrontOverlayBlocked: () => false,
}));

vi.mock("../hooks/useOverlaySlot", () => ({
  useOverlayBusy: () => false,
}));

vi.mock("../context/CartContext", () => ({
  useCart: () => ({ items: [{ variant_id: "v1", qty: 2 }] }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AbandonedCartBanner", () => {
  it("renders cart icon CTA linking to /checkout instead of oversized text, and dismisses cleanly", () => {
    vi.spyOn(cartReminder, "shouldShowAbandonedCartReminder").mockReturnValue(true);
    const dismissSpy = vi.spyOn(cartReminder, "dismissAbandonedCartReminder").mockImplementation(() => {});

    render(
      <MemoryRouter>
        <AbandonedCartBanner />
      </MemoryRouter>
    );

    expect(screen.getByText("Masih ada 2 item di keranjang")).toBeInTheDocument();

    const ctaLink = screen.getByRole("link", { name: "Lanjut checkout (2 item)" });
    expect(ctaLink).toHaveAttribute("href", "/checkout");
    expect(ctaLink.className).toContain("btn-icon");
    expect(ctaLink.textContent.trim()).toBe("");
    expect(ctaLink.querySelector("svg")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Tutup" }));
    expect(dismissSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
