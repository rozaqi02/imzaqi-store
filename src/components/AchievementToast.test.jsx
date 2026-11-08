import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AchievementToast from "./AchievementToast";
import * as orderHistory from "../lib/orderHistory";
import * as achievements from "../lib/achievements";

vi.mock("../hooks/useFunnelRoute", () => ({
  useStorefrontOverlayBlocked: () => false,
}));

vi.mock("../hooks/useOverlaySlot", () => ({
  useOverlayBusy: () => false,
}));

describe("AchievementToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("displays an achievement and automatically dismisses after 4 seconds", async () => {
    vi.spyOn(orderHistory, "getOrderHistory").mockReturnValue([
      { order_code: "IMZ-1", status: "done" },
    ]);
    vi.spyOn(achievements, "getNewAchievements").mockReturnValue([
      { id: "first_order", title: "Order Perdana", desc: "Pesanan pertamamu berhasil!" },
    ]);

    render(<AchievementToast />);

    // Should display the achievement
    expect(screen.getByText("Pencapaian baru!")).toBeInTheDocument();
    expect(screen.getByText("Order Perdana")).toBeInTheDocument();
    expect(screen.getByText("Pesanan pertamamu berhasil!")).toBeInTheDocument();

    // Advance 4000ms
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    // Should now be dismissed
    expect(screen.queryByText("Pencapaian baru!")).not.toBeInTheDocument();
  });
});
