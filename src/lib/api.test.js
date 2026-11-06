import * as fc from "fast-check";
import { describe, it, expect, vi } from "vitest";
import { csvEscapeValue, buildOrdersCSV, checkStockAvailability } from "./api";
import { supabase } from "./supabaseClient";

vi.mock("./supabaseClient", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe("csvEscapeValue", () => {
  it("returns empty string for nullish values", () => {
    expect(csvEscapeValue(null)).toBe("");
    expect(csvEscapeValue(undefined)).toBe("");
  });

  it("wraps values containing semicolons, quotes, or newlines", () => {
    expect(csvEscapeValue("a;b")).toBe('"a;b"');
    expect(csvEscapeValue('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscapeValue("line\nbreak")).toBe('"line\nbreak"');
  });
});

describe("buildOrdersCSV", () => {
  it("includes header row and one data row per order", () => {
    const csv = buildOrdersCSV([
      {
        order_code: "IMZ-001",
        created_at: "2026-06-01T10:00:00Z",
        status: "pending",
        customer_whatsapp: "08123456789",
        subtotal_idr: 50000,
        discount_percent: 0,
        total_idr: 50000,
        promo_code: "",
        items: [{ product_name: "Netflix", variant_name: "Sharing", duration_label: "1 bulan", qty: 1 }],
        notes: "catatan",
        admin_note: "admin",
      },
    ]);

    const lines = csv.split("\n");
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain("Kode Pesanan");
    expect(lines[1]).toContain("IMZ-001");
  });

  it("maps done and paid_reported status labels for CSV", () => {
    const csv = buildOrdersCSV([
      { order_code: "A", created_at: "2026-01-01T00:00:00Z", status: "done", total_idr: 1, subtotal_idr: 1 },
      { order_code: "B", created_at: "2026-01-01T00:00:00Z", status: "paid_reported", total_idr: 1, subtotal_idr: 1 },
    ]);
    expect(csv).toContain("Selesai");
    expect(csv).toContain("Lapor Bayar");
    expect(csv).not.toMatch(/;done;/);
    expect(csv).not.toMatch(/;paid_reported;/);
  });

  describe("checkStockAvailability", () => {
    it("treats stock: null as available (untracked stock)", async () => {
      supabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          in: vi.fn().mockResolvedValueOnce({
            data: [
              { id: "v-null-stock", name: "Netflix Sharing", stock: null, is_active: true },
              { id: "v-empty-stock", name: "Canva Pro", stock: "", is_active: true },
              { id: "v-zero-stock", name: "Spotify", stock: 0, is_active: true },
            ],
            error: null,
          }),
        }),
      });

      const result = await checkStockAvailability([
        { variant_id: "v-null-stock", qty: 2 },
        { variant_id: "v-empty-stock", qty: 1 },
        { variant_id: "v-zero-stock", qty: 1 },
      ]);

      expect(result.outOfStock).toHaveLength(1);
      expect(result.outOfStock[0].variant_id).toBe("v-zero-stock");
      expect(result.insufficient).toHaveLength(0);
    });
  });
});