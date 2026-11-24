import { describe, it, expect, vi } from "vitest";

const mockFrom = vi.fn();

vi.mock("./supabaseClient", () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
  },
}));

import { reportWebVital } from "./webVitalsReporter";

describe("webVitalsReporter", () => {
  it("does not write synthetic /__vitals/* rows into page_views", async () => {
    await reportWebVital({ name: "LCP", value: 1420, id: "v1-test" });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
