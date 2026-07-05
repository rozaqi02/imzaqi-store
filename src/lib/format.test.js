import * as fc from "fast-check";
import { describe, it, expect } from "vitest";
import { asVariantList, getTimeline, normalizeProductRecord } from "./format";

describe("asVariantList", () => {
  it("returns arrays only", () => {
    expect(asVariantList([{ id: 1 }])).toEqual([{ id: 1 }]);
    expect(asVariantList(null)).toEqual([]);
    expect(asVariantList({ broken: true })).toEqual([]);
  });
});

describe("normalizeProductRecord", () => {
  it("coerces malformed variant lists", () => {
    expect(normalizeProductRecord({ id: "x", product_variants: "bad" }).product_variants).toEqual([]);
  });
});

describe("getTimeline", () => {
  it("returns cancelled flow for cancelled orders", () => {
    const steps = getTimeline("cancelled");
    expect(steps.map((s) => s.key)).toEqual(["pending", "cancelled"]);
    expect(steps[1].active).toBe(true);
    expect(steps[1].done).toBe(false);
  });

  it("marks done step complete only for done status", () => {
    const doneSteps = getTimeline("done");
    const pendingSteps = getTimeline("pending");
    expect(doneSteps.find((s) => s.key === "done")?.done).toBe(true);
    expect(pendingSteps.find((s) => s.key === "done")?.done).toBe(false);
  });

  it("always starts with pending and never returns empty timeline", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("pending", "paid_reported", "processing", "done", "cancelled", "", "unknown"),
        (status) => {
          const steps = getTimeline(status);
          expect(steps.length).toBeGreaterThanOrEqual(2);
          expect(steps[0].key).toBe("pending");
        }
      ),
      { numRuns: 50 }
    );
  });
});