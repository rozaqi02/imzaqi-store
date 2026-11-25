/** Shared site navigation items - keep Header + BottomNav in sync. */

export const SITE_PRIMARY_NAV = [
  { to: "/", label: "Beranda", shortLabel: "Beranda" },
  { to: "/produk", label: "Katalog", shortLabel: "Katalog" },
  { to: "/faq", label: "Bantuan", shortLabel: "Bantuan" },
  { to: "/testimoni", label: "Testimoni", shortLabel: "Testimoni" },
];

export const SITE_DESKTOP_NAV = [
  ...SITE_PRIMARY_NAV,
  { to: "/status", label: "Cek Status", shortLabel: "Status" },
];

// Bottom nav menyertakan Testimoni dengan label ringkas agar tetap rapi di layar ponsel.
export const SITE_BOTTOM_NAV = [...SITE_DESKTOP_NAV];

export function isNavItemActive(pathname, to) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

/** Admin entry: dashboard when session is admin, otherwise login. */
export function getAdminNavTarget(canAccessAdmin) {
  return canAccessAdmin ? "/admin/dashboard" : "/admin";
}
