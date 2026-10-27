import React from "react";

const PAGE_FACTORIES = {
  faq: () => import("../pages/Faq"),
  products: () => import("../pages/Products"),
  productDetail: () => import("../pages/ProductDetail"),
  status: () => import("../pages/Status"),
  notFound: () => import("../pages/NotFound"),
  about: () => import("../pages/About"),
  testimonials: () => import("../pages/Testimonials"),
  promosi: () => import("../pages/Promosi"),
  checkout: () => import("../pages/Checkout"),
  pay: () => import("../pages/Pay"),
  adminLogin: () => import("../pages/admin/AdminLogin"),
  adminDashboard: () => import("../pages/admin/AdminDashboard"),
};

const pagePromises = new Map();

export function loadPage(key) {
  const factory = PAGE_FACTORIES[key];
  if (!factory) return Promise.reject(new Error(`Unknown page: ${key}`));
  if (!pagePromises.has(key)) pagePromises.set(key, factory());
  return pagePromises.get(key);
}

export function lazyPage(key) {
  return React.lazy(() => loadPage(key));
}

const PATH_TO_PAGE = {
  "/produk": "products",
  "/faq": "faq",
  "/testimoni": "testimonials",
  "/status": "status",
};

export function prefetchRoute(path) {
  if (!path) return;
  const clean = String(path).split(/[?#]/)[0];
  const key = clean.startsWith("/produk/") ? "productDetail" : PATH_TO_PAGE[clean];
  if (!key) return;
  loadPage(key).catch(() => pagePromises.delete(key));
}

export function prefetchPrimaryRoutes() {
  ["/produk", "/faq", "/testimoni", "/status"].forEach(prefetchRoute);
}
