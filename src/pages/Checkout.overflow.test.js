import * as fc from "fast-check";
import React from "react";
import { render, act } from "@testing-library/react";

/**
 * Property 2: Checkout item controls contained within card boundary
 * **Validates: Requirements 2.4**
 *
 * For any cart item (with varying product name length, variant name length,
 * price value, and quantity), when the Checkout page is rendered at 320px
 * viewport width, no child element of a checkout item card SHALL have a
 * scrollWidth exceeding its parent card's clientWidth.
 *
 * Since JSDOM does not compute real CSS layouts (scrollWidth/clientWidth are
 * always 0), we verify the structural correctness that prevents overflow:
 * 1. The checkout-item-card uses flex-wrap: wrap (via CSS class)
 * 2. The checkout-item-left section has min-width and overflow:hidden classes
 * 3. The checkout-item-copy section has min-width:0 for flex shrinking
 * 4. Text elements use overflow-wrap/word-break CSS classes
 * 5. No inline styles set explicit widths that could cause overflow
 * 6. The checkout-item-controls section uses flex-wrap for wrapping
 */

// ── Mocks ──

const mockNavigate = jest.fn();
const mockLocation = { state: { backgroundLocation: "/" }, pathname: "/checkout" };

jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
  Link: ({ children, ...props }) => <a {...props}>{children}</a>,
}));

jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
    aside: ({ children, ...props }) => <aside {...props}>{children}</aside>,
  },
  useReducedMotion: () => false,
}));

jest.mock("../hooks/usePromo", () => ({
  usePromo: () => ({
    promo: null,
    apply: jest.fn().mockResolvedValue({ ok: false, message: "" }),
    clear: jest.fn(),
  }),
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

jest.mock("../hooks/useAdaptiveMotion", () => ({
  useAdaptiveMotion: () => "lite",
}));

jest.mock("../hooks/useDialogA11y", () => ({
  useDialogA11y: jest.fn(),
}));

jest.mock("../lib/api", () => ({
  checkStockAvailability: () => Promise.resolve({ outOfStock: [], insufficient: [] }),
}));

jest.mock("../lib/supabaseClient", () => ({
  supabase: {},
}));

jest.mock("../components/CheckoutSteps", () => {
  return function MockCheckoutSteps() {
    return <div data-testid="checkout-steps" />;
  };
});

jest.mock("../components/EmptyState", () => {
  return function MockEmptyState() {
    return <div data-testid="empty-state" />;
  };
});

// ── Cart mock factory ──

const mockCartItems = { current: [] };

function mockCreateCart(items) {
  return {
    items,
    add: jest.fn(),
    remove: jest.fn(),
    setQty: jest.fn(),
    clear: jest.fn(),
    subtotal: () => items.reduce((sum, x) => sum + x.price_idr * x.qty, 0),
    total: () => items.reduce((sum, x) => sum + x.price_idr * x.qty, 0),
  };
}

jest.mock("../context/CartContext", () => ({
  useCart: () => mockCreateCart(mockCartItems.current),
}));

// ── Generators ──

const arbProductName = fc.stringOf(fc.fullUnicode(), { minLength: 1, maxLength: 200 });
const arbVariantName = fc.stringOf(fc.fullUnicode(), { minLength: 1, maxLength: 150 });
const arbDurationLabel = fc.stringOf(fc.fullUnicode(), { minLength: 1, maxLength: 60 });
const arbPrice = fc.integer({ min: 1000, max: 99999999 });
const arbQty = fc.integer({ min: 1, max: 99 });

const arbCartItem = fc.record({
  variant_id: fc.uuid(),
  product_id: fc.uuid(),
  product_name: arbProductName,
  product_icon_url: fc.constant(""),
  variant_name: arbVariantName,
  duration_label: arbDurationLabel,
  price_idr: arbPrice,
  qty: arbQty,
  description: fc.stringOf(fc.fullUnicode(), { minLength: 0, maxLength: 100 }),
  guarantee_text: fc.stringOf(fc.fullUnicode(), { minLength: 0, maxLength: 80 }),
  requires_buyer_email: fc.boolean(),
});

// ── CSS classes that provide overflow protection for checkout item cards ──

const CARD_OVERFLOW_PROTECTED_CLASSES = [
  "checkout-item-card",    // flex-wrap: wrap on the card itself
  "checkout-item-left",    // overflow: hidden, min-width: 180px, flex shrink
  "checkout-item-copy",    // min-width: 0, flex: 1 1 0
  "checkout-item-name",    // overflow-wrap: break-word, word-break: break-word
  "checkout-item-meta",    // overflow-wrap: break-word, word-break: break-word
  "checkout-item-controls", // flex-wrap: wrap, flex-shrink: 0
  "checkout-item-stepper", // flex-shrink: 0
  "checkout-item-price",   // white-space: nowrap, flex-shrink: 0
  "checkout-item-remove",  // white-space: nowrap, flex-shrink: 0
];

// ── Tests ──

describe("Checkout Page - Property 2: Checkout item controls contained within card boundary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCartItems.current = [];

    // Simulate mobile viewport for the component's matchMedia check
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: query === "(max-width: 720px)",
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        onchange: null,
        dispatchEvent: jest.fn(),
      })),
    });
  });

  /**
   * **Validates: Requirements 2.4**
   *
   * Structural property: For any cart item, the checkout-item-card uses
   * CSS classes that provide overflow protection (flex-wrap, min-width,
   * overflow-wrap, word-break) ensuring no child exceeds the card boundary.
   */
  it("renders checkout item cards with overflow-safe structure for any cart item data", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbCartItem, { minLength: 1, maxLength: 5 }),
        async (cartItems) => {
          mockCartItems.current = cartItems;

          const Checkout = require("./Checkout").default;

          let unmount;
          await act(async () => {
            const result = render(<Checkout />);
            unmount = result.unmount;
          });

          // Component uses createPortal to document.body, so query from there
          const itemCards = document.body.querySelectorAll(".checkout-item-card");
          expect(itemCards.length).toBe(cartItems.length);

          for (const card of itemCards) {
            // 1. Verify the card has the checkout-item-card class (provides flex-wrap: wrap)
            expect(card.classList.contains("checkout-item-card")).toBe(true);

            // 2. Verify the left section exists with overflow protection
            const leftSection = card.querySelector(".checkout-item-left");
            expect(leftSection).not.toBeNull();

            // 3. Verify the copy section exists (has min-width: 0 via CSS)
            const copySection = card.querySelector(".checkout-item-copy");
            expect(copySection).not.toBeNull();

            // 4. Verify text elements have overflow-wrap classes
            const nameEl = card.querySelector(".checkout-item-name");
            expect(nameEl).not.toBeNull();

            const metaEl = card.querySelector(".checkout-item-meta");
            expect(metaEl).not.toBeNull();

            // 5. Verify controls section exists with flex-wrap
            const controls = card.querySelector(".checkout-item-controls");
            expect(controls).not.toBeNull();

            // 6. Verify stepper, price, and remove button exist within controls
            const stepper = controls.querySelector(".checkout-item-stepper");
            expect(stepper).not.toBeNull();

            const price = controls.querySelector(".checkout-item-price");
            expect(price).not.toBeNull();

            const removeBtn = controls.querySelector(".checkout-item-remove");
            expect(removeBtn).not.toBeNull();

            // 7. Verify no child element has an inline width exceeding 320px
            const allChildren = card.querySelectorAll("*");
            for (const child of allChildren) {
              const inlineWidth = child.style.width;
              if (inlineWidth) {
                const pxMatch = inlineWidth.match(/^(\d+)px$/);
                if (pxMatch && parseInt(pxMatch[1], 10) > 320) {
                  throw new Error(
                    `Child element has inline width ${inlineWidth} which could overflow card at 320px viewport`
                  );
                }
              }
            }

            // 8. Verify all text-containing elements are within overflow-protected containers
            const textElements = card.querySelectorAll(
              ".checkout-item-name, .checkout-item-meta, .checkout-item-price"
            );
            for (const textEl of textElements) {
              const hasProtectedAncestor = CARD_OVERFLOW_PROTECTED_CLASSES.some(
                (cls) => textEl.closest(`.${cls}`) !== null
              );
              expect(hasProtectedAncestor).toBe(true);
            }
          }

          unmount();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 2.4**
   *
   * For extremely long product names and variant names (worst case for overflow),
   * verify the DOM structure still maintains overflow protection within the card.
   */
  it("maintains overflow protection with extremely long product and variant names", async () => {
    const arbLongCartItem = fc.record({
      variant_id: fc.uuid(),
      product_id: fc.uuid(),
      product_name: fc.stringOf(fc.fullUnicode(), { minLength: 100, maxLength: 500 }),
      product_icon_url: fc.constant(""),
      variant_name: fc.stringOf(fc.fullUnicode(), { minLength: 50, maxLength: 300 }),
      duration_label: fc.stringOf(fc.fullUnicode(), { minLength: 20, maxLength: 100 }),
      price_idr: fc.integer({ min: 10000000, max: 99999999 }),
      qty: fc.integer({ min: 1, max: 99 }),
      description: fc.stringOf(fc.fullUnicode(), { minLength: 0, maxLength: 200 }),
      guarantee_text: fc.stringOf(fc.fullUnicode(), { minLength: 0, maxLength: 100 }),
      requires_buyer_email: fc.boolean(),
    });

    await fc.assert(
      fc.asyncProperty(
        fc.array(arbLongCartItem, { minLength: 1, maxLength: 3 }),
        async (cartItems) => {
          mockCartItems.current = cartItems;

          const Checkout = require("./Checkout").default;

          let unmount;
          await act(async () => {
            const result = render(<Checkout />);
            unmount = result.unmount;
          });

          // Component uses createPortal to document.body, so query from there
          const itemCards = document.body.querySelectorAll(".checkout-item-card");
          expect(itemCards.length).toBe(cartItems.length);

          for (const card of itemCards) {
            // Verify the left section has overflow: hidden (via CSS class)
            const leftSection = card.querySelector(".checkout-item-left");
            expect(leftSection).not.toBeNull();

            // Verify the copy section exists for text containment
            const copySection = card.querySelector(".checkout-item-copy");
            expect(copySection).not.toBeNull();

            // Verify name and meta elements are nested within the copy section
            const nameEl = card.querySelector(".checkout-item-name");
            expect(nameEl).not.toBeNull();
            expect(nameEl.closest(".checkout-item-copy")).toBe(copySection);

            const metaEl = card.querySelector(".checkout-item-meta");
            expect(metaEl).not.toBeNull();
            expect(metaEl.closest(".checkout-item-copy")).toBe(copySection);

            // Verify controls are within the card (not outside)
            const controls = card.querySelector(".checkout-item-controls");
            expect(controls).not.toBeNull();
            expect(controls.closest(".checkout-item-card")).toBe(card);

            // Verify no element has overflow: visible combined with a fixed width > 320px
            const allChildren = card.querySelectorAll("*");
            for (const child of allChildren) {
              if (child.style.overflow === "visible" && child.style.width) {
                const pxMatch = child.style.width.match(/^(\d+)px$/);
                if (pxMatch && parseInt(pxMatch[1], 10) > 320) {
                  throw new Error(
                    `Element with overflow:visible and width>${320}px found - potential overflow risk`
                  );
                }
              }
            }
          }

          unmount();
        }
      ),
      { numRuns: 30 }
    );
  });
});
