import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

export default function SwUpdateToast() {
  const [waitingWorker, setWaitingWorker] = useState(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;

    navigator.serviceWorker.ready.then((registration) => {
      if (registration.waiting) setWaitingWorker(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingWorker(worker);
          }
        });
      });
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }, []);

  if (!waitingWorker) return null;

  return (
    <div className="sw-update-toast" role="status">
      <RefreshCw size={16} />
      <span>Versi baru tersedia</span>
      <button type="button" className="btn btn-sm" onClick={() => waitingWorker.postMessage({ type: "SKIP_WAITING" })}>
        Perbarui
      </button>
    </div>
  );
}
