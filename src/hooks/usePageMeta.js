import { useEffect } from "react";

const SITE_URL = "https://imzaqistore.my.id";
const DEFAULT_OG_IMAGE = `${SITE_URL}/imzaqistore_logo.png`;

function upsertMeta(selector, attrs) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "name" || k === "property") el.setAttribute(k, v);
    });
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([k, v]) => {
    el.setAttribute(k, v);
  });
}

function upsertLink(rel, attrs) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
}

/**
 * Per-page meta: title, description, OG, Twitter, canonical.
 * @param {object} options
 * @param {string} [options.title]
 * @param {string} [options.description]
 * @param {string} [options.ogImage] - Full URL. Falls back to site logo if not provided.
 */
export function usePageMeta({ title, description, ogImage } = {}) {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const base = "Imzaqi Store";
    const nextTitle = title ? `${title} - ${base}` : `${base} - Langganan Premium, Harga Pelajar`;
    const nextDesc = description || "Jual akun premium Netflix, Spotify, Canva, ChatGPT dan lainnya. Bayar QRIS, langsung aktif. Bergaransi.";
    const nextImage = ogImage || DEFAULT_OG_IMAGE;
    const nextUrl = typeof window !== "undefined" ? window.location.href : SITE_URL;
    const canonicalUrl = typeof window !== "undefined"
      ? `${SITE_URL}${window.location.pathname}`
      : SITE_URL;

    document.title = nextTitle;

    // Standard meta
    upsertMeta('meta[name="description"]', { name: "description", content: nextDesc });

    // Open Graph
    upsertMeta('meta[property="og:title"]', { property: "og:title", content: nextTitle });
    upsertMeta('meta[property="og:description"]', { property: "og:description", content: nextDesc });
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: nextUrl });
    upsertMeta('meta[property="og:image"]', { property: "og:image", content: nextImage });
    upsertMeta('meta[property="og:image:width"]', { property: "og:image:width", content: "1200" });
    upsertMeta('meta[property="og:image:height"]', { property: "og:image:height", content: "630" });

    // Twitter Card
    upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: nextTitle });
    upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: nextDesc });
    upsertMeta('meta[name="twitter:image"]', { name: "twitter:image", content: nextImage });

    // Canonical
    upsertLink("canonical", { rel: "canonical", href: canonicalUrl });
  }, [title, description, ogImage]);
}

export default usePageMeta;
