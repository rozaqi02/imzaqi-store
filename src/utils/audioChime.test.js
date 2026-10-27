import { describe, it, expect, vi, beforeEach } from "vitest";
import { playOrderAlertChime } from "./audioChime";

describe("audioChime", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("handles environment without window gracefully", () => {
    expect(() => playOrderAlertChime()).not.toThrow();
  });

  it("plays chime when AudioContext is supported", () => {
    const mockOsc = {
      type: "sine",
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    const mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };
    const mockCtx = {
      state: "running",
      currentTime: 10,
      createOscillator: vi.fn(() => mockOsc),
      createGain: vi.fn(() => mockGain),
      destination: {},
    };

    window.AudioContext = class {
      constructor() {
        return mockCtx;
      }
    };

    expect(() => playOrderAlertChime()).not.toThrow();
    expect(mockCtx.createOscillator).toHaveBeenCalled();
  });
});
