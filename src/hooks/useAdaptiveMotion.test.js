import * as fc from "fast-check";
import { detectMotionMode } from "./useAdaptiveMotion";

/**
 * Property 3: Motion mode detection correctness
 * Validates: Requirements 7.1, 7.3
 *
 * For any combination of viewport width, pointer type, and prefers-reduced-motion
 * preference, detectMotionMode SHALL return:
 * - "off" if prefers-reduced-motion is true (regardless of other inputs)
 * - "lite" if pointer is coarse OR viewport width ≤ 920px (and prefers-reduced-motion is false)
 * - "full" otherwise
 */

function mockMatchMedia({ viewportWidth, pointerCoarse, prefersReducedMotion }) {
  return (query) => {
    let matches = false;
    if (query === "(prefers-reduced-motion: reduce)") {
      matches = prefersReducedMotion;
    } else if (query === "(pointer: coarse)") {
      matches = pointerCoarse;
    } else if (query === "(max-width: 920px)") {
      matches = viewportWidth <= 920;
    }
    return {
      matches,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    };
  };
}

describe("detectMotionMode - Property 3: Motion mode detection correctness", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  /**
   * **Validates: Requirements 7.1, 7.3**
   */
  it("returns the correct motion mode for any combination of viewport width, pointer type, and prefers-reduced-motion", () => {
    fc.assert(
      fc.property(
        fc.record({
          viewportWidth: fc.integer({ min: 200, max: 3840 }),
          pointerCoarse: fc.boolean(),
          prefersReducedMotion: fc.boolean(),
        }),
        ({ viewportWidth, pointerCoarse, prefersReducedMotion }) => {
          window.matchMedia = mockMatchMedia({ viewportWidth, pointerCoarse, prefersReducedMotion });

          const result = detectMotionMode();

          if (prefersReducedMotion) {
            expect(result).toBe("off");
          } else if (pointerCoarse || viewportWidth <= 920) {
            expect(result).toBe("lite");
          } else {
            expect(result).toBe("full");
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 7.3**
   * prefers-reduced-motion takes highest priority regardless of other conditions
   */
  it("always returns 'off' when prefers-reduced-motion is true, regardless of viewport or pointer", () => {
    fc.assert(
      fc.property(
        fc.record({
          viewportWidth: fc.integer({ min: 200, max: 3840 }),
          pointerCoarse: fc.boolean(),
        }),
        ({ viewportWidth, pointerCoarse }) => {
          window.matchMedia = mockMatchMedia({
            viewportWidth,
            pointerCoarse,
            prefersReducedMotion: true,
          });

          expect(detectMotionMode()).toBe("off");
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 7.1**
   * Coarse pointer or narrow viewport (≤920px) triggers "lite" mode
   */
  it("returns 'lite' when pointer is coarse OR viewport ≤ 920px (and no reduced motion)", () => {
    fc.assert(
      fc.property(
        fc.record({
          viewportWidth: fc.integer({ min: 200, max: 3840 }),
          pointerCoarse: fc.boolean(),
        }).filter(({ viewportWidth, pointerCoarse }) => pointerCoarse || viewportWidth <= 920),
        ({ viewportWidth, pointerCoarse }) => {
          window.matchMedia = mockMatchMedia({
            viewportWidth,
            pointerCoarse,
            prefersReducedMotion: false,
          });

          expect(detectMotionMode()).toBe("lite");
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 7.1**
   * Fine pointer AND wide viewport (>920px) with no reduced motion → "full"
   */
  it("returns 'full' when pointer is fine AND viewport > 920px AND no reduced motion", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 921, max: 3840 }),
        (viewportWidth) => {
          window.matchMedia = mockMatchMedia({
            viewportWidth,
            pointerCoarse: false,
            prefersReducedMotion: false,
          });

          expect(detectMotionMode()).toBe("full");
        }
      ),
      { numRuns: 100 }
    );
  });
});
