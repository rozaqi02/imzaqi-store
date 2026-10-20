import { describe, it, expect, vi, beforeEach } from "vitest";
import { autoReleaseExpiredOrders } from "./orderExpiry";
import { supabase } from "./supabaseClient";

vi.mock("./supabaseClient", () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

describe("autoReleaseExpiredOrders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully calls atomic RPC when available", async () => {
    supabase.rpc.mockResolvedValueOnce({
      data: [{ released_count: 2, order_codes: ["ORD-1", "ORD-2"] }],
      error: null,
    });

    const result = await autoReleaseExpiredOrders({ expiryMinutes: 30 });
    expect(supabase.rpc).toHaveBeenCalledWith("auto_release_expired_orders", {
      p_expiry_minutes: 30,
    });
    expect(result.releasedCount).toBe(2);
    expect(result.orderCodes).toEqual(["ORD-1", "ORD-2"]);
  });

  it("falls back gracefully when RPC is not deployed", async () => {
    supabase.rpc.mockRejectedValueOnce(new Error("function does not exist"));

    const queryMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [{ id: "order-1", order_code: "ORD-FALLBACK-1" }],
        error: null,
      }),
      update: vi.fn().mockReturnThis(),
    };

    supabase.from.mockReturnValue(queryMock);
    supabase.rpc.mockResolvedValueOnce({ data: null, error: null }); // for cancel_order_with_stock_restore

    const result = await autoReleaseExpiredOrders({ expiryMinutes: 60 });
    expect(result.releasedCount).toBe(1);
    expect(result.orderCodes).toEqual(["ORD-FALLBACK-1"]);
  });
});
