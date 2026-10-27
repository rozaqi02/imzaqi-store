import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const PresenceContext = createContext({
  activeShoppers: 1,
  isSubscribed: false,
});

function getShopperKey() {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) {
      return "shopper-" + Math.random().toString(36).substring(2, 9);
    }
    let key = window.sessionStorage.getItem("imzaqi_shopper_key");
    if (!key) {
      key = "shopper-" + Math.random().toString(36).substring(2, 9);
      window.sessionStorage.setItem("imzaqi_shopper_key", key);
    }
    return key;
  } catch {
    return "shopper-" + Math.random().toString(36).substring(2, 9);
  }
}

function PresenceRouteSync({ channelRef, isSubscribed }) {
  const location = useLocation();
  // trackingStatus: "idle" | "tracking" | "tracked"
  const trackingStatusRef = useRef("idle");
  const isMountedRef = useRef(true);
  const locationRef = useRef(location);
  const isSubscribedRef = useRef(isSubscribed);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    isSubscribedRef.current = isSubscribed;
  }, [isSubscribed]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      trackingStatusRef.current = "idle";
    };
  }, []);

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !isSubscribed) {
      trackingStatusRef.current = "idle";
      return;
    }

    const isAdmin = location.pathname.startsWith("/admin");
    if (isAdmin) {
      // Only untrack if previously tracked or tracking on storefront
      // Prevents spamming untrack() on every internal admin navigation
      if (trackingStatusRef.current === "tracked" || trackingStatusRef.current === "tracking") {
        trackingStatusRef.current = "idle";
        channel.untrack().catch(() => {});
      }
      return;
    }

    // Only track once upon entering storefront or reconnecting
    // Prevents broadcast storms and duplicate calls while track() is in flight
    if (trackingStatusRef.current === "idle") {
      trackingStatusRef.current = "tracking";
      channel
        .track({
          online_at: new Date().toISOString(),
          page: location.pathname,
        })
        .then(() => {
          if (!isMountedRef.current) return;

          // Check if route or connection changed while track was in-flight
          const currentIsAdmin = locationRef.current.pathname.startsWith("/admin");
          const currentlySubscribed = isSubscribedRef.current;

          if (!currentlySubscribed) {
            trackingStatusRef.current = "idle";
            return;
          }

          if (currentIsAdmin) {
            trackingStatusRef.current = "idle";
            channel.untrack().catch(() => {});
            return;
          }

          trackingStatusRef.current = "tracked";
        })
        .catch(() => {
          if (!isMountedRef.current) return;
          trackingStatusRef.current = "idle";
        });
    }
  }, [location.pathname, isSubscribed, channelRef]);

  return null;
}

export function PresenceProvider({ children }) {
  const [activeShoppers, setActiveShoppers] = useState(1);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const channelRef = useRef(null);

  useEffect(() => {
    if (!supabase || typeof supabase.channel !== "function") {
      return undefined;
    }

    let isMounted = true;
    let channelInstance = null;

    try {
      const shopperKey = getShopperKey();
      const channel = supabase.channel("online-shoppers", {
        config: {
          presence: {
            key: shopperKey,
          },
        },
      });

      channelInstance = channel;
      channelRef.current = channel;

      channel
        .on("presence", { event: "sync" }, () => {
          if (!isMounted) return;
          try {
            const presenceState = channel.presenceState();
            const count = Object.keys(presenceState || {}).length;
            setActiveShoppers(Math.max(1, count));
          } catch {
            // Keep previous count on sync error
          }
        })
        .subscribe((status) => {
          if (!isMounted) return;
          if (status === "SUBSCRIBED") {
            setIsSubscribed(true);
          } else {
            setIsSubscribed(false);
          }
        });
    } catch {
      // Fallback gracefully if Supabase env is invalid or channel init throws
    }

    return () => {
      isMounted = false;
      const ch = channelInstance || channelRef.current;
      if (ch && typeof supabase.removeChannel === "function") {
        try {
          Promise.resolve(supabase.removeChannel(ch)).catch(() => {});
        } catch {}
      }
      channelRef.current = null;
    };
  }, []);

  const contextValue = useMemo(
    () => ({ activeShoppers, isSubscribed }),
    [activeShoppers, isSubscribed]
  );

  return (
    <PresenceContext.Provider value={contextValue}>
      <PresenceRouteSync channelRef={channelRef} isSubscribed={isSubscribed} />
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  return useContext(PresenceContext);
}
