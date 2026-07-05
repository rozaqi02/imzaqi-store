import { useLocation } from "react-router-dom";

const FUNNEL_PATHS = ["/checkout", "/bayar"];

export function isFunnelPath(pathname = "") {
  return FUNNEL_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function useFunnelRoute() {
  const { pathname } = useLocation();
  return isFunnelPath(pathname);
}