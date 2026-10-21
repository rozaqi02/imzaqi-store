import { useRef } from "react";

const FADE_ROUTES = ["/checkout", "/bayar", "/admin", "/admin/dashboard"];

function routeDepth(pathname) {
  const path = String(pathname || "/").split("?")[0];
  if (FADE_ROUTES.some((route) => path === route || path.startsWith(`${route}/`))) return "fade";
  if (path.startsWith("/produk/") && path !== "/produk") return 2;
  if (path === "/") return 0;
  return 1;
}

/**
 * Calculates page transition direction synchronously during render.
 * Avoids any state updates or useEffect delays that would cause class switches
 * and animation restart flickers.
 */
export function useRouteDirection(pathname) {
  const prevPathRef = useRef(pathname);
  const directionRef = useRef("fade");

  if (prevPathRef.current !== pathname) {
    const prevDepth = routeDepth(prevPathRef.current);
    const nextDepth = routeDepth(pathname);

    if (prevDepth === "fade" || nextDepth === "fade") {
      directionRef.current = "fade";
    } else if (nextDepth > prevDepth) {
      directionRef.current = "forward";
    } else if (nextDepth < prevDepth) {
      directionRef.current = "back";
    } else {
      directionRef.current = "fade";
    }

    prevPathRef.current = pathname;
  }

  return directionRef.current;
}
