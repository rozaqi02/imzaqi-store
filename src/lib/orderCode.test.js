import { describe, it, expect } from "vitest";
import { makeOrderCode, normalizeOrderCode, CODE_DEFAULT } from "./orderCode";

describe("orderCode", () => {
  describe("makeOrderCode", () => {
    it("generates a code with IMZ- prefix and 8 default characters", () => {
      const code = makeOrderCode();
      expect(code).toMatch(/^IMZ-[A-Z0-9]{8}$/);
    });

    it("supports custom length within range", () => {
      const code = makeOrderCode(6);
      expect(code).toMatch(/^IMZ-[A-Z0-9]{6}$/);
    });
  });

  describe("normalizeOrderCode", () => {
    it("normalizes 8-character code", () => {
      expect(normalizeOrderCode("ABCDEFGH")).toBe("IMZ-ABCDEFGH");
      expect(normalizeOrderCode("IMZ-ABCDEFGH")).toBe("IMZ-ABCDEFGH");
      expect(normalizeOrderCode("IMZABCDEFGH")).toBe("IMZ-ABCDEFGH");
    });

    it("keeps legacy 4-character codes searchable", () => {
      expect(normalizeOrderCode("ABCD")).toBe("IMZ-ABCD");
      expect(normalizeOrderCode("IMZ-ABCD")).toBe("IMZ-ABCD");
    });

    it("returns raw string if length is outside supported formats", () => {
      expect(normalizeOrderCode("AB")).toBe("AB");
      expect(normalizeOrderCode("")).toBe("");
      expect(normalizeOrderCode(null)).toBe("");
    });
  });
});
