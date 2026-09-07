import { useLocation } from "react-router-dom";

const FUNNEL_PATHS = ["/checkout", "/bayar"];

export function isFunnelPath(pathname = "") {
  return FUNNEL_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isAdminPath(pathname = "") {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function isStorefrontOverlayBlocked(pathname = "") {
  return isFunnelPath(pathname) || isAdminPath(pathname);
}

export function useFunnelRoute() {
  const { pathname } = useLocation();
  return isFunnelPath(pathname);
}

export function useStorefrontOverlayBlocked() {
  const { pathname } = useLocation();
  return isStorefrontOverlayBlocked(pathname);
}