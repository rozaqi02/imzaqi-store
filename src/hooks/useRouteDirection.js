import { useEffect, useRef, useState } from "react";

const FADE_ROUTES = ["/checkout", "/bayar", "/admin", "/admin/dashboard"];

function routeDepth(pathname) {
  const path = String(pathname || "/").split("?")[0];
  if (FADE_ROUTES.some((route) => path === route || path.startsWith(`${route}/`))) return "fade";
  if (path.startsWith("/produk/") && path !== "/produk") return 2;
  if (path === "/") return 0;
  return 1;
}

export function useRouteDirection(pathname) {
  const prevPathRef = useRef(pathname);
  const [direction, setDirection] = useState("fade");

  useEffect(() => {
    const prevDepth = routeDepth(prevPathRef.current);
    const nextDepth = routeDepth(pathname);

    if (prevDepth === "fade" || nextDepth === "fade") {
      setDirection("fade");
    } else if (nextDepth > prevDepth) {
      setDirection("forward");
    } else if (nextDepth < prevDepth) {
      setDirection("back");
    } else {
      setDirection("fade");
    }

    prevPathRef.current = pathname;
  }, [pathname]);

  return direction;
}