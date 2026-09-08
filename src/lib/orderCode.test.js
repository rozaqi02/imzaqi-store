import { describe, it, expect } from "vitest";
import { makeOrderCode, normalizeOrderCode, CODE_DEFAULT } from "./orderCode";

describe("orderCode", () => {
  describe("makeOrderCode", () => {
    it("generates a code with IMZ- prefix and 4 default characters", () => {
      const code = makeOrderCode();
      expect(code).toMatch(/^IMZ-[A-Z0-9]{4}$/);
    });

    it("supports custom length within range", () => {
      const code = makeOrderCode(6);
      expect(code).toMatch(/^IMZ-[A-Z0-9]{6}$/);
    });
  });

  describe("normalizeOrderCode", () => {
    it("normalizes short 4-character code to IMZ- prefix", () => {
      expect(normalizeOrderCode("ABCD")).toBe("IMZ-ABCD");
      expect(normalizeOrderCode("abcd")).toBe("IMZ-ABCD");
      expect(normalizeOrderCode("k7x2")).toBe("IMZ-K7X2");
    });

    it("normalizes pasted IMZ-4-character code", () => {
      expect(normalizeOrderCode("IMZ-ABCD")).toBe("IMZ-ABCD");
      expect(normalizeOrderCode("imz-k7x2")).toBe("IMZ-K7X2");
      expect(normalizeOrderCode("IMZABCD")).toBe("IMZ-ABCD");
    });

    it("normalizes 8-character code", () => {
      expect(normalizeOrderCode("ABCDEFGH")).toBe("IMZ-ABCDEFGH");
      expect(normalizeOrderCode("IMZ-ABCDEFGH")).toBe("IMZ-ABCDEFGH");
      expect(normalizeOrderCode("IMZABCDEFGH")).toBe("IMZ-ABCDEFGH");
    });

    it("returns raw string if length is outside standard 4-8 chars", () => {
      expect(normalizeOrderCode("AB")).toBe("AB");
      expect(normalizeOrderCode("")).toBe("");
      expect(normalizeOrderCode(null)).toBe("");
    });
  });
});
