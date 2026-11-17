import React from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TypewriterSearchInput from "./TypewriterSearchInput";

describe("TypewriterSearchInput", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }));
    document.documentElement.removeAttribute("data-motion");
  });

  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.removeAttribute("data-motion");
  });

  it("keeps 'Ketik ' static and cycles only the product word across Netflix, Canva, YouTube, Spotify, CapCut", () => {
    render(<TypewriterSearchInput aria-label="Cari produk" value="" onChange={() => {}} />);
    const input = screen.getByRole("textbox", { name: "Cari produk" });

    expect(input).toHaveAttribute("placeholder", "Ketik ");

    const seenWords = new Set();
    const milestones = [];

    for (let step = 0; step < 360; step++) {
      act(() => {
        vi.advanceTimersByTime(50);
      });
      const ph = input.getAttribute("placeholder") || "";
      expect(ph.startsWith("Ketik ")).toBe(true);
      milestones.push(ph);
      for (const word of ["Netflix", "Canva", "YouTube", "Spotify", "CapCut"]) {
        if (ph === `Ketik ${word}`) seenWords.add(word);
      }
      if (seenWords.size === 5) break;
    }

    expect([...seenWords]).toEqual(["Netflix", "Canva", "YouTube", "Spotify", "CapCut"]);
    expect(milestones.some((p) => p === "Ketik Net")).toBe(true);
    expect(milestones.some((p) => p === "Ketik C")).toBe(true);
    expect(milestones.every((p) => p.startsWith("Ketik "))).toBe(true);
  });

  it("renders static 'Ketik Netflix' when reduced motion or data-motion=off is active", () => {
    document.documentElement.setAttribute("data-motion", "off");
    render(<TypewriterSearchInput aria-label="Cari produk" value="" onChange={() => {}} />);
    const input = screen.getByRole("textbox", { name: "Cari produk" });

    expect(input).toHaveAttribute("placeholder", "Ketik Netflix");
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(input).toHaveAttribute("placeholder", "Ketik Netflix");
  });
});
