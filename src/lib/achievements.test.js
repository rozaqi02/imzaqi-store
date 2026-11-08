import { describe, expect, it } from "vitest";
import { checkAchievements, getNewAchievements } from "./achievements";

describe("achievements streak calculations", () => {
  it("correctly identifies a 2-month streak across double-digit months (October & November)", () => {
    localStorage.clear();
    const history = [
      { order_code: "ORD-1", status: "done", created_at: "2025-10-15T10:00:00.000Z" },
      { order_code: "ORD-2", status: "done", created_at: "2025-11-20T10:00:00.000Z" },
    ];
    const unlocked = checkAchievements(history);
    const ids = unlocked.map((a) => a.id);
    expect(ids).toContain("streak_2");
    expect(ids).not.toContain("streak_3");
  });

  it("correctly identifies a 3-month streak even if subsequent orders skip months", () => {
    localStorage.clear();
    const history = [
      { order_code: "ORD-1", status: "done", created_at: "2025-01-15T10:00:00.000Z" },
      { order_code: "ORD-2", status: "done", created_at: "2025-02-15T10:00:00.000Z" },
      { order_code: "ORD-3", status: "done", created_at: "2025-03-15T10:00:00.000Z" },
      { order_code: "ORD-4", status: "done", created_at: "2025-08-15T10:00:00.000Z" },
    ];
    const unlocked = checkAchievements(history);
    const ids = unlocked.map((a) => a.id);
    expect(ids).toContain("streak_2");
    expect(ids).toContain("streak_3");
  });

  it("does not unlock streak if orders are not in consecutive months", () => {
    localStorage.clear();
    const history = [
      { order_code: "ORD-1", status: "done", created_at: "2025-01-15T10:00:00.000Z" },
      { order_code: "ORD-2", status: "done", created_at: "2025-03-15T10:00:00.000Z" },
      { order_code: "ORD-3", status: "done", created_at: "2025-05-15T10:00:00.000Z" },
    ];
    const unlocked = checkAchievements(history);
    const ids = unlocked.map((a) => a.id);
    expect(ids).not.toContain("streak_2");
    expect(ids).not.toContain("streak_3");
  });

  it("getNewAchievements evaluates history and unlocks new achievements", () => {
    localStorage.clear();
    const history = [
      { order_code: "ORD-1", status: "done", created_at: "2025-01-15T10:00:00.000Z" },
    ];
    const newOnes = getNewAchievements(history);
    expect(newOnes.map((a) => a.id)).toContain("first_order");

    // Second call should return empty because it was marked seen
    const secondCall = getNewAchievements(history);
    expect(secondCall).toHaveLength(0);
  });
});
