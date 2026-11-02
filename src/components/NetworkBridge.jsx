import React, { useEffect, useRef } from "react";
import { useToast } from "../context/ToastContext";

/**
 * Shows a toast when user goes offline/online.
 * Hardened with initial connection guard and 3s debounce to prevent false-positives on first load (BUG-01).
 */
export default function NetworkBridge() {
  const toast = useToast();
  const hasConnectedOnce = useRef(false);
  const offlineTimerRef = useRef(null);

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      hasConnectedOnce.current = true;
    }

    function onOffline() {
      // Guard: only show disconnected toast if internet was previously connected, not during initial boot
      if (!hasConnectedOnce.current) return;

      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
      // Debounce 3000ms: if connection recovers within 3s (brief handshake/glitch), do not alert
      offlineTimerRef.current = setTimeout(() => {
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          toast.error("Koneksi terputus. Cek internet kamu ya.", { duration: 5000 });
        }
      }, 3000);
    }

    function onOnline() {
      if (offlineTimerRef.current) {
        clearTimeout(offlineTimerRef.current);
        offlineTimerRef.current = null;
      }
      if (hasConnectedOnce.current) {
        toast.success("Koneksi balik normal.", { duration: 2200 });
      }
      hasConnectedOnce.current = true;
    }

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    return () => {
      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [toast]);

  return null;
}
