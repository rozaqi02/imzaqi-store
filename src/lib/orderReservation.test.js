import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "./supabaseClient";
import { createOrderReservation } from "./orderReservation";

vi.mock("./supabaseClient", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("./visitor", () => ({ getVisitorIdAsUUID: () => "550e8400-e29b-41d4-a716-446655440000" }));

describe("order reservation compatibility", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("unlocks checkout with a legacy reservation when the new RPC is not deployed", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "Could not find the function create_pending_order_reservation" } });
    const result = await createOrderReservation({
      items: [{ variant_id: "variant-1", qty: 1 }],
      whatsapp: "6281234567890",
    });
    expect(result.legacy).toBe(true);
    expect(result.order_code).toMatch(/^IMZ-[A-Z0-9]{8}$/);
  });

  it("keeps real stock errors blocking the payment screen", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { code: "P0001", message: "INSUFFICIENT_STOCK" } });
    await expect(createOrderReservation({
      items: [{ variant_id: "variant-1", qty: 1 }],
      whatsapp: "6281234567890",
    })).rejects.toMatchObject({ message: "INSUFFICIENT_STOCK" });
  });
});
