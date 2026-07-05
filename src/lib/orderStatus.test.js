import { describe, it, expect } from "vitest";
import {
  prettyOrderStatus,
  orderStatusCsvLabel,
  getOrderStatusTone,
  ORDER_STATUS_OPTIONS,
} from "./orderStatus";

describe("orderStatus", () => {
  it("maps all known statuses for UI", () => {
    expect(prettyOrderStatus("done")).toBe("Sukses");
    expect(prettyOrderStatus("paid_reported")).toBe("Lapor Bayar");
    expect(prettyOrderStatus("unknown")).toBe("unknown");
  });

  it("maps all known statuses for CSV", () => {
    expect(orderStatusCsvLabel("done")).toBe("Selesai");
    expect(orderStatusCsvLabel("paid_reported")).toBe("Lapor Bayar");
  });

  it("exposes option list with labels", () => {
    expect(ORDER_STATUS_OPTIONS.some((o) => o.value === "done" && o.label === "Sukses")).toBe(true);
  });

  it("returns tone classes", () => {
    expect(getOrderStatusTone("paid_reported")).toBe("reported");
    expect(getOrderStatusTone("done")).toBe("done");
  });
});