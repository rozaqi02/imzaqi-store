import React from "react";
import { act, render, renderHook } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PresenceProvider, usePresence } from "./PresenceContext";

let mockChannel;
let presenceCallbacks = {};
let subscribeCallback;

vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    channel: vi.fn(() => mockChannel),
    removeChannel: vi.fn(),
  },
}));

describe("PresenceContext & PresenceProvider", () => {
  beforeEach(() => {
    sessionStorage.clear();
    presenceCallbacks = {};
    mockChannel = {
      on: vi.fn((event, filter, callback) => {
        presenceCallbacks[`${event}:${filter.event}`] = callback;
        return mockChannel;
      }),
      subscribe: vi.fn((callback) => {
        subscribeCallback = callback;
        return mockChannel;
      }),
      track: vi.fn(() => Promise.resolve()),
      untrack: vi.fn(() => Promise.resolve()),
      presenceState: vi.fn(() => ({
        "shopper-1": [{ online_at: "2026-10-27T10:00:00Z" }],
        "shopper-2": [{ online_at: "2026-10-27T10:01:00Z" }],
      })),
    };
  });

  it("provides default activeShoppers as 1 outside provider", () => {
    const { result } = renderHook(() => usePresence());
    expect(result.current.activeShoppers).toBe(1);
    expect(result.current.isSubscribed).toBe(false);
  });

  it("subscribes to online-shoppers channel and tracks on subscribe", async () => {
    let contextValue;
    function Consumer() {
      contextValue = usePresence();
      return <div>Active: {contextValue.activeShoppers}</div>;
    }

    render(
      <MemoryRouter initialEntries={["/produk"]}>
        <PresenceProvider>
          <Consumer />
        </PresenceProvider>
      </MemoryRouter>
    );

    expect(mockChannel.on).toHaveBeenCalled();
    expect(mockChannel.subscribe).toHaveBeenCalled();

    // Trigger SUBSCRIBED
    await act(async () => {
      await subscribeCallback("SUBSCRIBED");
    });

    expect(mockChannel.track).toHaveBeenCalledWith(
      expect.objectContaining({
        page: "/produk",
      })
    );
    expect(contextValue.isSubscribed).toBe(true);
  });

  it("does not re-track on storefront route transitions to prevent broadcast storms", async () => {
    let navigate;
    function Consumer() {
      navigate = useNavigate();
      const { activeShoppers } = usePresence();
      return <div>Active: {activeShoppers}</div>;
    }

    render(
      <MemoryRouter initialEntries={["/produk"]}>
        <PresenceProvider>
          <Consumer />
        </PresenceProvider>
      </MemoryRouter>
    );

    await act(async () => {
      await subscribeCallback("SUBSCRIBED");
    });

    expect(mockChannel.track).toHaveBeenCalledTimes(1);

    // Navigate to another storefront page
    await act(async () => {
      navigate("/checkout");
    });

    // Should NOT call track again for storefront page navigation
    expect(mockChannel.track).toHaveBeenCalledTimes(1);
  });

  it("updates activeShoppers when presence sync event fires", async () => {
    let contextValue;
    function Consumer() {
      contextValue = usePresence();
      return <div>Active: {contextValue.activeShoppers}</div>;
    }

    render(
      <MemoryRouter initialEntries={["/"]}>
        <PresenceProvider>
          <Consumer />
        </PresenceProvider>
      </MemoryRouter>
    );

    // Trigger presence sync
    act(() => {
      if (presenceCallbacks["presence:sync"]) {
        presenceCallbacks["presence:sync"]();
      }
    });

    expect(contextValue.activeShoppers).toBe(2);
  });

  it("untracks shopper if user navigates to admin route", async () => {
    let navigate;
    function Consumer() {
      navigate = useNavigate();
      const { activeShoppers } = usePresence();
      return <div>Active: {activeShoppers}</div>;
    }

    render(
      <MemoryRouter initialEntries={["/produk"]}>
        <PresenceProvider>
          <Consumer />
        </PresenceProvider>
      </MemoryRouter>
    );

    await act(async () => {
      await subscribeCallback("SUBSCRIBED");
    });

    await act(async () => {
      navigate("/admin/dashboard");
    });

    expect(mockChannel.untrack).toHaveBeenCalledTimes(1);

    // Navigating between admin subpages should not untrack repeatedly
    await act(async () => {
      navigate("/admin/login");
    });

    expect(mockChannel.untrack).toHaveBeenCalledTimes(1);

    // Navigating back to storefront should track again
    await act(async () => {
      navigate("/produk/netflix");
    });

    expect(mockChannel.track).toHaveBeenCalledTimes(2);
  });

  it("handles TIMED_OUT status and re-tracks when reconnected", async () => {
    let contextValue;
    function Consumer() {
      contextValue = usePresence();
      return <div>Active: {contextValue.activeShoppers}</div>;
    }

    render(
      <MemoryRouter initialEntries={["/produk"]}>
        <PresenceProvider>
          <Consumer />
        </PresenceProvider>
      </MemoryRouter>
    );

    await act(async () => {
      await subscribeCallback("SUBSCRIBED");
    });
    expect(contextValue.isSubscribed).toBe(true);
    expect(mockChannel.track).toHaveBeenCalledTimes(1);

    // Connection timed out
    await act(async () => {
      await subscribeCallback("TIMED_OUT");
    });
    expect(contextValue.isSubscribed).toBe(false);

    // Reconnected
    await act(async () => {
      await subscribeCallback("SUBSCRIBED");
    });
    expect(contextValue.isSubscribed).toBe(true);
    expect(mockChannel.track).toHaveBeenCalledTimes(2);
  });

  it("safely handles track and untrack promise rejections without throwing", async () => {
    mockChannel.track = vi.fn(() => Promise.reject(new Error("Network error")));
    mockChannel.untrack = vi.fn(() => Promise.reject(new Error("Network error")));

    let navigate;
    function Consumer() {
      navigate = useNavigate();
      return <div>Test</div>;
    }

    render(
      <MemoryRouter initialEntries={["/"]}>
        <PresenceProvider>
          <Consumer />
        </PresenceProvider>
      </MemoryRouter>
    );

    // Should not throw unhandled rejection
    await expect(
      act(async () => {
        await subscribeCallback("SUBSCRIBED");
      })
    ).resolves.not.toThrow();

    await expect(
      act(async () => {
        navigate("/admin");
      })
    ).resolves.not.toThrow();
  });

  it("does not update state if presence sync or subscribe fires after unmount", async () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={["/"]}>
        <PresenceProvider>
          <div>Child</div>
        </PresenceProvider>
      </MemoryRouter>
    );

    unmount();

    // Callbacks after unmount should safely exit without errors
    expect(() => {
      if (presenceCallbacks["presence:sync"]) {
        presenceCallbacks["presence:sync"]();
      }
      if (subscribeCallback) {
        subscribeCallback("SUBSCRIBED");
      }
    }).not.toThrow();
  });
});

