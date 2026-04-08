import { clamp, formatIDR, slugify } from "./lib/format";
import { makeOrderCode } from "./lib/orderCode";

describe("format helpers", () => {
  test("slugify normalizes input", () => {
    expect(slugify("Netflix Premium 4K")).toBe("netflix-premium-4k");
  });

  test("clamp keeps value in range", () => {
    expect(clamp(10, 1, 5)).toBe(5);
    expect(clamp(-2, 1, 5)).toBe(1);
    expect(clamp(3, 1, 5)).toBe(3);
  });

  test("formatIDR returns rupiah string", () => {
    expect(formatIDR(12500)).toMatch(/rp/i);
  });
});

describe("order code", () => {
  test("uses IMZ prefix and requested length", () => {
    const code = makeOrderCode(4);
    expect(code).toMatch(/^IMZ-[A-Z2-9]{4}$/);
  });
});
