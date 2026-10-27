import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Hero from "./Hero";

// Mock supabase client
vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    channel: () => ({
      on: () => ({
        subscribe: () => ({}),
      }),
      presenceState: () => ({}),
      track: () => Promise.resolve(),
    }),
    removeChannel: () => {},
  },
}));

// Mock useLiveStats
vi.mock("../hooks/useLiveStats", () => ({
  useLiveStats: () => ({
    last7DaysViews: 1250,
    totalOrders: 340,
  }),
}));

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  global.IntersectionObserver = class {
    constructor(callback) {
      this.callback = callback;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("Hero Component & Headline Entrance", () => {
  it("renders the hero with proper accessible label and headline", () => {
    render(
      <MemoryRouter>
        <Hero products={[]} />
      </MemoryRouter>
    );

    const heroSection = screen.getByRole("region", { name: "Marketplace Hero" });
    expect(heroSection).toBeInTheDocument();

    const headline = screen.getByRole("heading", { level: 1 });
    expect(headline).toHaveAttribute("aria-label", "Akses Premium Budget Pelajar");
    expect(headline).toHaveClass("hx-headline", "hx-headline--kinetic");
  });

  it("handles empty or undefined products prop gracefully", () => {
    const { container } = render(
      <MemoryRouter>
        <Hero />
      </MemoryRouter>
    );

    expect(container.querySelector(".hx-headline")).toBeInTheDocument();
    expect(screen.getByText("Akses")).toBeInTheDocument();
    expect(screen.getByText("Pelajar")).toBeInTheDocument();
  });

  it("renders all 4 words with clean kinetic structure and no pen-nib or clip ink hacks", () => {
    const { container } = render(
      <MemoryRouter>
        <Hero products={[]} />
      </MemoryRouter>
    );

    // Verify all 4 words are in DOM
    const word0 = container.querySelector(".hx-word-0");
    const word1 = container.querySelector(".hx-word-1");
    const word2 = container.querySelector(".hx-word-2");
    const word3 = container.querySelector(".hx-word-3");

    expect(word0).toHaveTextContent("Akses");
    expect(word1).toHaveTextContent("Premium");
    expect(word2).toHaveTextContent("Budget");
    expect(word3).toHaveTextContent("Pelajar");

    // Word 1 and Word 3 should have gradient styling
    expect(word1).toHaveClass("hx-headline-gradient");
    expect(word3).toHaveClass("hx-headline-gradient");
    expect(word0).not.toHaveClass("hx-headline-gradient");
    expect(word2).not.toHaveClass("hx-headline-gradient");

    // Old writing nib and measure hacks must NOT exist
    expect(container.querySelector(".hx-penNib")).toBeNull();
    expect(container.querySelector(".hx-typeMeasure")).toBeNull();
    expect(container.querySelector(".hx-writeInk")).toBeNull();
  });

  it("renders subtitle and call-to-action buttons", () => {
    render(
      <MemoryRouter>
        <Hero products={[]} />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/Akses premium tanpa boncos/i)
    ).toBeInTheDocument();

    const catalogBtn = screen.getByRole("link", { name: /Gas Lihat Katalog/i });
    expect(catalogBtn).toHaveAttribute("href", "/produk");

    const statusBtn = screen.getByRole("link", { name: /Cek Status/i });
    expect(statusBtn).toHaveAttribute("href", "/status");
  });

  it("renders active shoppers badge with fallback value and label", () => {
    render(
      <MemoryRouter>
        <Hero products={[]} />
      </MemoryRouter>
    );

    expect(screen.getByText("Pembeli Online")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("assigns index-based stagger css variable --w to all headline words", () => {
    const { container } = render(
      <MemoryRouter>
        <Hero products={[]} />
      </MemoryRouter>
    );

    const words = container.querySelectorAll(".hx-headline-word");
    expect(words).toHaveLength(4);
    words.forEach((word, index) => {
      expect(word.style.getPropertyValue("--w")).toBe(String(index));
    });
  });

  it("latches hero visibility once active, preventing re-trigger or FOUC on visibility changes", () => {
    const { container } = render(
      <MemoryRouter>
        <Hero products={[]} />
      </MemoryRouter>
    );

    const section = container.querySelector(".hx-hero");
    expect(section).toHaveAttribute("data-hero-active", "true");

    // Simulate tab switch (document hidden)
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));

    // Latching state ensures active remains true, so animation doesn't reset/flicker
    expect(section).toHaveAttribute("data-hero-active", "true");

    // Restore document.hidden
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(section).toHaveAttribute("data-hero-active", "true");
  });
});

describe("Hero Animation CSS Guardrails", () => {
  const heroAnimCss = readFileSync(
    resolve(process.cwd(), "src/css/hero-animations.css"),
    "utf8"
  );
  const homeCss = readFileSync(
    resolve(process.cwd(), "src/css/pages/Home.css"),
    "utf8"
  );

  it("defines modern kinetic keyframes and has removed the obsolete writing nib keyframes", () => {
    expect(heroAnimCss).toMatch(/@keyframes heroWordReveal/);
    expect(heroAnimCss).toMatch(/@keyframes heroGradientWordReveal/);
    expect(heroAnimCss).not.toMatch(/@keyframes inkWriteIn/);
    expect(heroAnimCss).not.toMatch(/@keyframes penNibGlide/);
    expect(heroAnimCss).not.toMatch(/\.hx-penNib/);
    expect(heroAnimCss).not.toMatch(/\.hx-writeInk/);
  });

  it("coordinates snappy timings where headline words and downstream elements trigger without excessive delay", () => {
    // Word animations trigger within snappy timeframe
    expect(heroAnimCss).toMatch(/\.hx-word-0\s*\{\s*animation:[^;]*0\.10s/);
    expect(heroAnimCss).toMatch(/\.hx-word-3\s*\{\s*animation:[^;]*0\.34s/);

    // Subtitle and CTAs appear snappily (under 1s, not 2.5s+)
    expect(heroAnimCss).toMatch(/--hero-entry-delay:\s*0\.44s;/); // subtitle
    expect(heroAnimCss).toMatch(/--hero-entry-delay:\s*0\.56s;/); // CTA 1
  });

  it("preserves descender safety and supports reduced motion in hero-animations.css", () => {
    expect(heroAnimCss).toMatch(/padding-bottom:\s*0\.12em/);
    expect(heroAnimCss).toMatch(/overflow:\s*visible/);
    expect(heroAnimCss).toMatch(/data-hero-reduced="true"/);
    expect(heroAnimCss).toMatch(/prefers-reduced-motion:\s*reduce/);
  });

  it("ensures mobile headline rules in Home.css provide descender clearance and do not block transform animations", () => {
    expect(homeCss).toMatch(/\.home-page\s+\.hx-hero\s+\.hx-headline-word\s*\{[^}]*line-height:\s*1\.08/);
    expect(homeCss).toMatch(/\.home-page\s+\.hx-hero\s+\.hx-headline-word\s*\{[^}]*padding-bottom:\s*0\.12em/);
    // Ensure transform: none !important is not forcibly suppressing word animation on mobile
    expect(homeCss).not.toMatch(/\.home-page\s+\.hx-hero\s+\.hx-headline-word\s*\{[^}]*transform:\s*none\s*!important/);
  });

  it("ensures CTA buttons retain hover and active transform interactions without animation lock", () => {
    expect(heroAnimCss).toMatch(/\.hx-hero--choreographed\s+\.hx-ctas-row\s*>\s*a:hover\s*\{[^}]*transform:\s*translateY\(-2px\)\s*!important/);
    expect(heroAnimCss).toMatch(/\.hx-hero--choreographed\s+\.hx-ctas-row\s*>\s*a:active\s*\{[^}]*transform:\s*translateY\(1px\)\s*!important/);
  });

  it("harmonizes Home.css keyframes and timing with snappy kinetic entrance", () => {
    expect(homeCss).toMatch(/@keyframes hxHeadlineWordIn\s*\{[^}]*transform:\s*translate3d\(0,\s*18px,\s*0\)\s*scale\(0\.96\)/);
    expect(homeCss).toMatch(/animation:\s*hxHeadlineWordIn\s*0\.48s/);
    expect(homeCss).toMatch(/html\[data-motion="off"\]\s+\.hx-headline--kinetic\s+\.hx-headline-word/);
  });
});
