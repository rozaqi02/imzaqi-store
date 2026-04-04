import React from "react";
import { useLocation } from "react-router-dom";

/**
 * Tiny top progress bar shown on every route change.
 * This improves perceived performance even on instant navigations.
 */
export default function RouteProgress() {
  const { pathname } = useLocation();
  const [show, setShow] = React.useState(false);
  const tRef = React.useRef(null);
  const firstLoadRef = React.useRef(true);

  React.useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      (window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        window.matchMedia("(max-width: 720px)").matches);

    if (firstLoadRef.current) {
      firstLoadRef.current = false;
      return undefined;
    }

    if (prefersReduced) {
      setShow(false);
      return undefined;
    }

    setShow(true);
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setShow(false), 500);
    return () => {
      if (tRef.current) clearTimeout(tRef.current);
    };
  }, [pathname]);

  if (!show) return null;
  return (
    <div className="route-progress" aria-hidden="true">
      <div className="route-progress-bar" />
    </div>
  );
}
