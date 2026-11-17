import { useRef } from "react";

const FADE_ROUTES = ["/checkout", "/bayar", "/admin", "/admin/dashboard"];

const TAB_ORDER = {
  "/": 0,
  "/produk": 1,
  "/faq": 2,
  "/testimoni": 2.2,
  "/promosi": 2.4,
  "/tentang": 2.6,
  "/status": 3,
};

function cleanPath(pathname) {
  return String(pathname || "/").split(/[?#]/)[0] || "/";
}

function routeDepth(pathname) {
  const path = cleanPath(pathname);
  if (FADE_ROUTES.some((route) => path === route || path.startsWith(`${route}/`))) return "fade";
  if (path.startsWith("/produk/") && path !== "/produk") return 2;
  if (path === "/") return 0;
  return 1;
}

function resolveTabIndex(pathname) {
  const path = cleanPath(pathname);
  if (Object.prototype.hasOwnProperty.call(TAB_ORDER, path)) {
    return TAB_ORDER[path];
  }
  return null;
}

export function resolveRouteDirection(prevPathname, nextPathname) {
  const prevDepth = routeDepth(prevPathname);
  const nextDepth = routeDepth(nextPathname);

  if (prevDepth === "fade" || nextDepth === "fade") {
    return "fade";
  }

  if (nextDepth === 2 && prevDepth < 2) {
    return "push";
  }

  if (prevDepth === 2 && nextDepth < 2) {
    return "pop";
  }

  const prevTab = resolveTabIndex(prevPathname);
  const nextTab = resolveTabIndex(nextPathname);
  if (prevTab != null && nextTab != null && prevTab !== nextTab) {
    return nextTab > prevTab ? "tab-right" : "tab-left";
  }

  if (nextDepth > prevDepth) return "push";
  if (nextDepth < prevDepth) return "pop";
  return "fade";
}

/**
 * Calculates spatial page transition direction synchronously during render.
 */
export function useRouteDirection(pathname) {
  const prevPathRef = useRef(pathname);
  const directionRef = useRef("fade");

  if (prevPathRef.current !== pathname) {
    directionRef.current = resolveRouteDirection(prevPathRef.current, pathname);
    prevPathRef.current = pathname;
  }

  return directionRef.current;
}
