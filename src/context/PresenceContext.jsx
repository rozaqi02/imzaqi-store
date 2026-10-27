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
  const isTrackedRef = useRef(false);

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !isSubscribed) {
      isTrackedRef.current = false;
      return;
    }

    const isAdmin = location.pathname.startsWith("/admin");
    if (isAdmin) {
      // Only untrack if previously tracked on storefront
      // Prevents spamming untrack() on every internal admin navigation
      if (isTrackedRef.current) {
        channel.untrack().catch(() => {});
        isTrackedRef.current = false;
      }
      return;
    }

    // Only track once upon entering storefront or reconnecting
    // Prevents broadcast storms (excessive message quota burn) when navigating catalog pages
    if (!isTrackedRef.current) {
      channel
        .track({
          online_at: new Date().toISOString(),
          page: location.pathname,
        })
        .then(() => {
          isTrackedRef.current = true;
        })
        .catch(() => {
          isTrackedRef.current = false;
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

    try {
      const shopperKey = getShopperKey();
      const channel = supabase.channel("online-shoppers", {
        config: {
          presence: {
            key: shopperKey,
          },
        },
      });

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
      try {
        if (channelRef.current && typeof supabase.removeChannel === "function") {
          Promise.resolve(supabase.removeChannel(channelRef.current)).catch(() => {});
        }
      } catch {}
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
