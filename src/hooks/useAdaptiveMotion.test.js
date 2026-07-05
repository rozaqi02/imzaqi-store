import * as fc from "fast-check";
import { detectMotionMode } from "./useAdaptiveMotion";
import { PHONE_LAYOUT_MEDIA, TABLET_LAYOUT_MEDIA } from "../lib/breakpoints";

function mockMatchMedia({ viewportWidth, pointerCoarse, prefersReducedMotion }) {
  return (query) => {
    let matches = false;
    if (query === "(prefers-reduced-motion: reduce)") {
      matches = prefersReducedMotion;
    } else if (query === "(pointer: coarse)") {
      matches = pointerCoarse;
    } else if (query === "(max-width: 920px)") {
      matches = viewportWidth <= 920;
    } else if (query === PHONE_LAYOUT_MEDIA) {
      matches = viewportWidth <= 720;
    } else if (query === TABLET_LAYOUT_MEDIA) {
      matches = viewportWidth >= 721 && viewportWidth <= 1024;
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

function expectedMotionMode({ viewportWidth, pointerCoarse, prefersReducedMotion }) {
  if (prefersReducedMotion) return "off";
  if (viewportWidth >= 721 && viewportWidth <= 1024) return "full";
  if (viewportWidth <= 720) return "lite";
  if (pointerCoarse || viewportWidth <= 920) return "lite";
  return "full";
}

describe("detectMotionMode - Property 3: Motion mode detection correctness", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

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
          expect(detectMotionMode()).toBe(
            expectedMotionMode({ viewportWidth, pointerCoarse, prefersReducedMotion })
          );
        }
      ),
      { numRuns: 200 }
    );
  });

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

  it("returns 'full' on iPad-sized viewports (721–1024px) when reduced motion is off", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 721, max: 1024 }),
        fc.boolean(),
        (viewportWidth, pointerCoarse) => {
          window.matchMedia = mockMatchMedia({
            viewportWidth,
            pointerCoarse,
            prefersReducedMotion: false,
          });

          expect(detectMotionMode()).toBe("full");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("returns 'lite' on phone-sized viewports (≤720px) when reduced motion is off", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 200, max: 720 }),
        fc.boolean(),
        (viewportWidth, pointerCoarse) => {
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

  it("returns 'full' when pointer is fine AND viewport > 1024px AND no reduced motion", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1025, max: 3840 }),
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