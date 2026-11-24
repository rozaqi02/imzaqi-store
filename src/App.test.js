import { buildRedirectTarget, useCheckoutOverlayLocation } from "./App";
import { isActiveOrderForFloatingStatus } from "./components/FloatingOrderStatus";
import { RAGE_CLICK_SELECTOR } from "./hooks/useGlobalInteractionFeedback";

describe("useCheckoutOverlayLocation", () => {
  test("activates overlay when on /checkout with backgroundLocation", () => {
    const bg = { pathname: "/produk", search: "" };
    const loc = { pathname: "/checkout", state: { backgroundLocation: bg } };
    const res = useCheckoutOverlayLocation(loc);
    expect(res.showCheckoutOverlay).toBe(true);
    expect(res.displayLocation).toBe(bg);
  });

  test("does not activate overlay when on /checkout without backgroundLocation", () => {
    const loc = { pathname: "/checkout", state: null };
    const res = useCheckoutOverlayLocation(loc);
    expect(res.showCheckoutOverlay).toBe(false);
    expect(res.displayLocation).toBe(loc);
  });

  test("does not activate overlay on /bayar even if backgroundLocation is present", () => {
    const bg = { pathname: "/produk", search: "" };
    const loc = { pathname: "/bayar", state: { backgroundLocation: bg } };
    const res = useCheckoutOverlayLocation(loc);
    expect(res.showCheckoutOverlay).toBe(false);
    expect(res.displayLocation).toBe(loc);
  });

  test("does not activate overlay on storefront or other pages", () => {
    const loc = { pathname: "/", state: null };
    const res = useCheckoutOverlayLocation(loc);
    expect(res.showCheckoutOverlay).toBe(false);
    expect(res.displayLocation).toBe(loc);
  });
});

describe("buildRedirectTarget", () => {
  test("preserves incoming query parameters on redirect", () => {
    expect(buildRedirectTarget("/status", "?order=IMZ-ABCD1234")).toBe(
      "/status?order=IMZ-ABCD1234"
    );
    expect(buildRedirectTarget("/checkout", "?ref=teman")).toBe(
      "/checkout?ref=teman"
    );
  });

  test("merges incoming query parameters when target already has query string", () => {
    expect(buildRedirectTarget("/status?tab=riwayat", "?order=IMZ-ABCD1234")).toBe(
      "/status?tab=riwayat&order=IMZ-ABCD1234"
    );
  });

  test("returns target unchanged when search is empty", () => {
    expect(buildRedirectTarget("/status", "")).toBe("/status");
    expect(buildRedirectTarget("/status?tab=riwayat", "?")).toBe("/status?tab=riwayat");
  });
});

describe("isActiveOrderForFloatingStatus", () => {
  const now = Date.parse("2026-11-24T12:00:00Z");

  test("returns true for recent active order statuses", () => {
    expect(
      isActiveOrderForFloatingStatus(
        { order_code: "IMZ-PEND1111", status: "pending", created_at: "2026-11-24T10:00:00Z" },
        now
      )
    ).toBe(true);
    expect(
      isActiveOrderForFloatingStatus(
        { order_code: "IMZ-PROC2222", status: "processing", created_at: "2026-11-24T08:00:00Z" },
        now
      )
    ).toBe(true);
  });

  test("returns false for terminal order statuses (done, cancelled, expired)", () => {
    for (const status of ["done", "cancelled", "expired"]) {
      expect(
        isActiveOrderForFloatingStatus(
          { order_code: "IMZ-TERM3333", status, created_at: "2026-11-24T11:30:00Z" },
          now
        )
      ).toBe(false);
    }
  });

  test("returns false for orders older than 24 hours", () => {
    expect(
      isActiveOrderForFloatingStatus(
        { order_code: "IMZ-OLD4444", status: "pending", created_at: "2026-11-23T11:59:59Z" },
        now
      )
    ).toBe(false);
  });
});

describe("RAGE_CLICK_SELECTOR", () => {
  test("matches disabled buttons but ignores disabled form inputs", () => {
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <button id="btn" disabled>Bayar</button>
      <input id="inp" disabled value="readonly" />
      <select id="sel" disabled><option>A</option></select>
    `;
    expect(wrap.querySelector("#btn").matches(RAGE_CLICK_SELECTOR)).toBe(true);
    expect(wrap.querySelector("#inp").matches(RAGE_CLICK_SELECTOR)).toBe(false);
    expect(wrap.querySelector("#sel").matches(RAGE_CLICK_SELECTOR)).toBe(false);
  });
});
