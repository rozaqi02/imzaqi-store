export const PRODUCT_SCHEMA_ID = "jsonld-product";
export function productStructuredData(product, prices) {
  const data = {
    "@context": "https://schema.org", "@type": "Product",
    name: product.name, description: product.description || "",
    image: product.icon_url || "https://imzaqi.store/imzaqistore_logo.png",
    url: `https://imzaqi.store/produk/${encodeURIComponent(product.slug)}`,
    brand: { "@type": "Brand", name: "Imzaqi Store" },
  };
  if (prices?.count) data.offers = {
    "@type": "AggregateOffer", priceCurrency: "IDR",
    lowPrice: prices.min, highPrice: prices.max, offerCount: prices.count,
    availability: `https://schema.org/${prices.stock > 0 ? "InStock" : "OutOfStock"}`,
  };
  return data;
}
