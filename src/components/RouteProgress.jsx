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

  React.useEffect(() => {
    // show quickly, hide a bit later
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
