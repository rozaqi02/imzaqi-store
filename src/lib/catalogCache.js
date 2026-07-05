let products = null;

export function getCatalogProductsCache() {
  return products;
}

export function setCatalogProductsCache(data) {
  products = Array.isArray(data) ? data : null;
}

export function hasCatalogProductsCache() {
  return Array.isArray(products) && products.length > 0;
}