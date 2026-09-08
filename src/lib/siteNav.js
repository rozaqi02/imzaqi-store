/** Shared site navigation items — keep Header + BottomNav in sync. */

export const SITE_PRIMARY_NAV = [
  { to: "/", label: "Beranda", shortLabel: "Beranda" },
  { to: "/produk", label: "Katalog", shortLabel: "Katalog" },
  { to: "/faq", label: "FAQ", shortLabel: "FAQ" },
  { to: "/testimoni", label: "Testimoni", shortLabel: "Ulasan" },
];

export const SITE_DESKTOP_NAV = [
  ...SITE_PRIMARY_NAV,
  { to: "/status", label: "Cek Status", shortLabel: "Status" },
];

// Bottom nav memprioritaskan bantuan saat pengguna mobile membutuhkan jawaban cepat.
export const SITE_BOTTOM_NAV = [
  { to: "/", label: "Beranda", shortLabel: "Beranda" },
  { to: "/produk", label: "Katalog", shortLabel: "Katalog" },
  { to: "/faq", label: "FAQ", shortLabel: "Bantuan" },
  { to: "/status", label: "Cek Status", shortLabel: "Status" },
];

export function isNavItemActive(pathname, to) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

/** Admin entry: dashboard when session is admin, otherwise login. */
export function getAdminNavTarget(canAccessAdmin) {
  return canAccessAdmin ? "/admin/dashboard" : "/admin";
}
