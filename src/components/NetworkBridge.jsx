import React from "react";
import { useToast } from "../context/ToastContext";

/**
 * Small UX polish: shows a toast when user goes offline/online.
 */
export default function NetworkBridge() {
  const toast = useToast();

  React.useEffect(() => {
    function onOffline() {
      toast.error("Koneksi terputus. Cek internet kamu ya.", { duration: 5000 });
    }
    function onOnline() {
      toast.success("Koneksi balik normal ✅", { duration: 2200 });
    }

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    // initial hint (only if already offline)
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      onOffline();
    }

    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [toast]);

  return null;
}
