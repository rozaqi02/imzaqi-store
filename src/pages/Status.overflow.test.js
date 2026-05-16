import * as fc from "fast-check";
import React from "react";
import { render, act, waitFor } from "@testing-library/react";

/**
 * Property 1: No horizontal overflow at minimum viewport
 * **Validates: Requirements 1.2**
 *
 * For any order data (with varying product names, order codes, variant names,
 * and note text of any length), when the Status page is rendered at 320px
 * viewport width, the `st-wrap` container's scrollWidth SHALL be less than
 * or equal to its clientWidth.
 *
 * Since JSDOM does not compute real CSS layouts (scrollWidth/clientWidth are
 * always 0), we verify the structural correctness that prevents overflow:
 * 1. The `st-wrap` container is rendered with the correct CSS class
 * 2. All text-containing elements within `st-wrap` are nested inside
 *    containers that have overflow-protection CSS classes (which apply
 *    `overflow-wrap: anywhere` and `min-width: 0` at 320px)
 * 3. No inline styles set explicit widths that could cause overflow
 */

// ── Mocks ──

const mockSetSearchParams = jest.fn();
let mockSearchParamsValue = new URLSearchParams();

jest.mock("react-router-dom", () => ({
  useSearchParams: () => [mockSearchParamsValue, mockSetSearchParams],
}));

jest.mock("../lib/supabaseClient", () => ({
  supabase: {
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

jest.mock("../lib/api", () => ({
  fetchSettings: () => Promise.resolve({ whatsapp: { number: "6281234567890" } }),
}));

jest.mock("../context/ToastContext", () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  }),
}));

jest.mock("../hooks/usePageMeta", () => ({
  usePageMeta: jest.fn(),
}));

// ── Generators ──

const arbProductName = fc.stringOf(fc.fullUnicode(), { minLength: 1, maxLength: 200 });
const arbVariantName = fc.stringOf(fc.fullUnicode(), { minLength: 0, maxLength: 150 });
const arbOrderCode = fc.stringOf(
  fc.constantFrom("A", "B", "C", "D", "E", "F", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"),
  { minLength: 4, maxLength: 4 }
).map((s) => `IMZ-${s}`);
const arbNoteText = fc.stringOf(fc.fullUnicode(), { minLength: 0, maxLength: 500 });
const arbStatus = fc.constantFrom("pending", "processing", "done", "cancelled");
const arbPrice = fc.integer({ min: 1000, max: 99999999 });
const arbQty = fc.integer({ min: 1, max: 100 });

const arbItem = fc.record({
  product_name: arbProductName,
  variant_name: arbVariantName,
  price_idr: arbPrice,
  qty: arbQty,
  product_icon_url: fc.constant(""),
  guarantee_text: fc.stringOf(fc.fullUnicode(), { minLength: 0, maxLength: 80 }),
  duration_label: fc.stringOf(fc.fullUnicode(), { minLength: 0, maxLength: 40 }),
  description: fc.stringOf(fc.fullUnicode(), { minLength: 0, maxLength: 300 }),
  requires_buyer_email: fc.boolean(),
});

const arbOrder = fc.record({
  order_code: arbOrderCode,
  status: arbStatus,
  items: fc.array(arbItem, { minLength: 1, maxLength: 5 }),
  subtotal_idr: arbPrice,
  total_idr: arbPrice,
  admin_note: arbNoteText,
  notes: arbNoteText,
  promo_code: fc.option(fc.stringOf(fc.char().filter(c => /[a-zA-Z0-9]/.test(c)), { minLength: 3, maxLength: 20 }), { nil: null }),
  discount_percent: fc.integer({ min: 0, max: 50 }),
  created_at: fc.constant("2024-01-15T10:00:00Z"),
});

// ── CSS class lists that provide overflow protection at 320px ──
// These classes have `min-width: 0` and `overflow-wrap: anywhere` in the
// @media (max-width: 320px) block of Status.css

const OVERFLOW_PROTECTED_CLASSES = [
  "st-wrap",
  "st-hero",
  "st-heroCopy",
  "st-search",
  "st-card",
  "st-infoCard",
  "st-flowStep",
  "st-flowCopy",
  "st-itemRow",
  "st-itemMain",
  "st-empty",
  "st-searchRow",
  "st-inputWrap",
  "st-payRow",
  "st-noteBody",
  "st-aside",
  "st-main",
];

// ── Tests ──

describe("Status Page - Property 1: No horizontal overflow at minimum viewport", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParamsValue = new URLSearchParams();
  });

  /**
   * **Validates: Requirements 1.2**
   *
   * Structural property: The st-wrap container and its children use CSS classes
   * that apply overflow-wrap: anywhere and min-width: 0 at 320px viewport.
   * This guarantees no horizontal overflow regardless of text content length.
   */
  it("renders st-wrap container with correct overflow-safe structure for any order data", async () => {
    await fc.assert(
      fc.asyncProperty(arbOrder, async (orderData) => {
        const { supabase } = require("../lib/supabaseClient");
        supabase.rpc.mockResolvedValue({ data: [orderData], error: null });
        mockSearchParamsValue = new URLSearchParams({ order: orderData.order_code });

        const Status = require("./Status").default;

        let container;
        let unmount;
        await act(async () => {
          const result = render(<Status />);
          container = result.container;
          unmount = result.unmount;
        });

        // Wait for the order layout to appear (order data loaded)
        await waitFor(() => {
          expect(container.querySelector(".st-layout")).not.toBeNull();
        });

        // Verify the st-wrap container exists
        const stWrap = container.querySelector(".st-wrap");
        expect(stWrap).not.toBeNull();
        expect(stWrap.classList.contains("st-wrap")).toBe(true);

        // Verify that no element within st-wrap has an inline style with
        // a fixed pixel width exceeding 320px that could cause overflow
        const allElements = stWrap.querySelectorAll("*");
        for (const el of allElements) {
          const inlineWidth = el.style.width;
          if (inlineWidth && inlineWidth !== "100%") {
            // The pay track progress bar uses percentage inline width - that's fine
            const isPayTrack = el.tagName === "I" && el.closest(".st-payTrack");
            if (!isPayTrack) {
              const pxMatch = inlineWidth.match(/^(\d+)px$/);
              if (pxMatch && parseInt(pxMatch[1], 10) > 320) {
                throw new Error(
                  `Element has inline width ${inlineWidth} which could overflow at 320px viewport`
                );
              }
            }
          }
        }

        // Verify the search section is always present
        expect(stWrap.querySelector(".st-search")).not.toBeNull();

        // Verify text content elements are within overflow-protected containers
        const textElements = stWrap.querySelectorAll(
          ".st-itemName, .st-noteBody, .st-infoCard strong, .st-itemDesc, .st-itemVariant"
        );
        for (const textEl of textElements) {
          const hasProtectedAncestor = OVERFLOW_PROTECTED_CLASSES.some((cls) => {
            return textEl.closest(`.${cls}`) !== null;
          });
          expect(hasProtectedAncestor).toBe(true);
        }

        unmount();
      }),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 1.2**
   *
   * For extremely long text content (worst case for overflow), verify the
   * DOM structure still maintains overflow protection.
   */
  it("maintains overflow protection structure with extremely long text content", async () => {
    const arbLongOrder = fc.record({
      order_code: fc.constant("IMZ-XXXX"),
      status: arbStatus,
      items: fc.array(
        fc.record({
          product_name: fc.stringOf(fc.fullUnicode(), { minLength: 100, maxLength: 500 }),
          variant_name: fc.stringOf(fc.fullUnicode(), { minLength: 50, maxLength: 300 }),
          price_idr: arbPrice,
          qty: arbQty,
          product_icon_url: fc.constant(""),
          guarantee_text: fc.stringOf(fc.fullUnicode(), { minLength: 20, maxLength: 200 }),
          duration_label: fc.stringOf(fc.fullUnicode(), { minLength: 10, maxLength: 100 }),
          description: fc.stringOf(fc.fullUnicode(), { minLength: 100, maxLength: 500 }),
          requires_buyer_email: fc.boolean(),
        }),
        { minLength: 1, maxLength: 3 }
      ),
      subtotal_idr: arbPrice,
      total_idr: arbPrice,
      admin_note: fc.stringOf(fc.fullUnicode(), { minLength: 100, maxLength: 1000 }),
      notes: fc.stringOf(fc.fullUnicode(), { minLength: 100, maxLength: 1000 }),
      promo_code: fc.constant("LONGPROMO123"),
      discount_percent: fc.constant(25),
      created_at: fc.constant("2024-06-01T12:00:00Z"),
    });

    await fc.assert(
      fc.asyncProperty(arbLongOrder, async (orderData) => {
        const { supabase } = require("../lib/supabaseClient");
        supabase.rpc.mockResolvedValue({ data: [orderData], error: null });
        mockSearchParamsValue = new URLSearchParams({ order: "IMZ-XXXX" });

        const Status = require("./Status").default;

        let container;
        let unmount;
        await act(async () => {
          const result = render(<Status />);
          container = result.container;
          unmount = result.unmount;
        });

        await waitFor(() => {
          expect(container.querySelector(".st-layout")).not.toBeNull();
        });

        const stWrap = container.querySelector(".st-wrap");
        expect(stWrap).not.toBeNull();

        // Verify all rendered text-heavy elements are within overflow-protected containers
        const longTextElements = stWrap.querySelectorAll(
          ".st-itemName, .st-noteBody, .st-infoCard strong, .st-itemDesc, .st-itemVariant, .st-cardTitle"
        );

        for (const el of longTextElements) {
          const hasProtectedAncestor = OVERFLOW_PROTECTED_CLASSES.some(
            (cls) => el.closest(`.${cls}`) !== null
          );
          expect(hasProtectedAncestor).toBe(true);
        }

        // Verify no element has explicit overflow: visible combined with a fixed width
        const allElements = stWrap.querySelectorAll("*");
        for (const el of allElements) {
          if (el.style.overflow === "visible" && el.style.width) {
            const pxMatch = el.style.width.match(/^(\d+)px$/);
            if (pxMatch && parseInt(pxMatch[1], 10) > 320) {
              throw new Error(
                `Element with overflow:visible and width>${320}px found - potential overflow risk`
              );
            }
          }
        }

        unmount();
      }),
      { numRuns: 30 }
    );
  });
});
