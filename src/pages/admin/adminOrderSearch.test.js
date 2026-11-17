import { describe, expect, it, vi } from "vitest";
import {
  fetchAllOrdersForSearch,
  getOrderDateSearchTokens,
  mergeOrdersById,
  orderMatchesAdminQuery,
  patchOrderInList,
} from "./adminOrderSearch";

const sampleOrder = {
  id: "ord-uuid-1",
  order_code: "IMZ-20261116-0042",
  created_at: "2026-11-16T22:30:00.000Z", // 17 Nov 2026, 05:30 WIB (UTC+7)
  status: "done",
  customer_whatsapp: "6281234567890",
  buyer_email: "budi.santoso@example.com",
  promo_code: "HEMAT10",
  notes: "Tolong proses cepat untuk tugas kuliah besok pagi",
  admin_note: "Akun cadangan sudah dikirim ke WA",
  items: [
    {
      product_name: "Canva Pro/Edu",
      variant_name: "Canva Pro (bulanan)",
      duration_label: "1 bulan",
      qty: 1,
    },
  ],
};

describe("adminOrderSearch", () => {
  it("matches customer notes and admin notes case-insensitively", () => {
    expect(orderMatchesAdminQuery(sampleOrder, "tugas kuliah")).toBe(true);
    expect(orderMatchesAdminQuery(sampleOrder, "BESOK PAGI")).toBe(true);
    expect(orderMatchesAdminQuery(sampleOrder, "akun cadangan")).toBe(true);
    expect(orderMatchesAdminQuery(sampleOrder, "catatan tidak ada")).toBe(false);
  });

  it("matches product items, variants, durations, and normalized WhatsApp numbers", () => {
    expect(orderMatchesAdminQuery(sampleOrder, "canva pro")).toBe(true);
    expect(orderMatchesAdminQuery(sampleOrder, "bulanan")).toBe(true);
    expect(orderMatchesAdminQuery(sampleOrder, "1 bulan")).toBe(true);
    expect(orderMatchesAdminQuery(sampleOrder, "08123456")).toBe(true);
    expect(orderMatchesAdminQuery(sampleOrder, "IMZ-20261116")).toBe(true);
  });

  it("matches WIB calendar dates across ISO, Indonesian month, slash, and multi-term queries", () => {
    const tokens = getOrderDateSearchTokens(sampleOrder.created_at);
    expect(tokens.join(" ")).toContain("2026-11-17");
    expect(orderMatchesAdminQuery(sampleOrder, "17 nov 2026")).toBe(true);
    expect(orderMatchesAdminQuery(sampleOrder, "17 november")).toBe(true);
    expect(orderMatchesAdminQuery(sampleOrder, "2026-11-17")).toBe(true);
    expect(orderMatchesAdminQuery(sampleOrder, "17/11/2026")).toBe(true);
    expect(orderMatchesAdminQuery(sampleOrder, "17-11-2026")).toBe(true);
    expect(orderMatchesAdminQuery(sampleOrder, "17 nov canva")).toBe(true);
    expect(orderMatchesAdminQuery(sampleOrder, "canva 17 nov")).toBe(true);
    expect(orderMatchesAdminQuery(sampleOrder, "16 nov")).toBe(false);
  });

  it("paginates through all batches without an arbitrary 60-order limit", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({ id: `id-${i}`, order_code: `O-${i}` }));
    const page2 = Array.from({ length: 1000 }, (_, i) => ({ id: `id-${1000 + i}`, order_code: `O-${1000 + i}` }));
    const page3 = Array.from({ length: 45 }, (_, i) => ({ id: `id-${2000 + i}`, order_code: `O-${2000 + i}` }));
    const fetchBatch = vi
      .fn()
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2)
      .mockResolvedValueOnce(page3);
    const onBatch = vi.fn();

    const result = await fetchAllOrdersForSearch({ fetchBatch, batchSize: 1000, onBatch });

    expect(fetchBatch).toHaveBeenCalledTimes(3);
    expect(fetchBatch).toHaveBeenNthCalledWith(1, 0, 999);
    expect(fetchBatch).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(fetchBatch).toHaveBeenNthCalledWith(3, 2000, 2999);
    expect(result).toHaveLength(2045);
    expect(onBatch).toHaveBeenCalledTimes(3);
  });

  it("deduplicates merged lists and patches matching orders immutably", () => {
    const merged = mergeOrdersById(
      [{ id: "a", status: "done" }],
      [{ id: "a", status: "pending" }, { id: "b", status: "pending" }]
    );
    expect(merged).toEqual([{ id: "a", status: "done" }, { id: "b", status: "pending" }]);

    const patched = patchOrderInList(merged, "b", { status: "done" });
    expect(patched[1].status).toBe("done");
    expect(merged[1].status).toBe("pending");
  });
});
