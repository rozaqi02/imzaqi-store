import { useEffect } from "react";

function upsertMeta(selector, attrs) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    Object.entries(attrs).forEach(([k, v]) => {
      // the identifying attribute (name/property) must exist on create
      if (k === "name" || k === "property") el.setAttribute(k, v);
    });
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([k, v]) => {
    el.setAttribute(k, v);
  });
}

/**
 * Simple per-page meta (title + description + OG) without extra deps.
 * @param {object} options
 * @param {string} [options.title]
 * @param {string} [options.description]
 * @param {string} [options.ogImage] - Optional og:image URL; only updates the tag if provided
 */
export function usePageMeta({ title, description, ogImage } = {}) {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const base = "Imzaqi Store";
    const nextTitle = title ? `${title} - ${base}` : `${base} - Digital Subscription Store`;
    document.title = nextTitle;

    if (description) {
      upsertMeta('meta[name="description"]', { name: "description", content: description });
      upsertMeta('meta[property="og:title"]', { property: "og:title", content: nextTitle });
      upsertMeta('meta[property="og:description"]', { property: "og:description", content: description });
    } else {
      // keep OG title in sync even if no custom desc
      upsertMeta('meta[property="og:title"]', { property: "og:title", content: nextTitle });
    }

    // og:url — always update to current page URL
    if (typeof window !== "undefined") {
      upsertMeta('meta[property="og:url"]', { property: "og:url", content: window.location.href });
    }

    // og:image — only update if ogImage is explicitly provided
    if (ogImage) {
      upsertMeta('meta[property="og:image"]', { property: "og:image", content: ogImage });
    }
  }, [title, description, ogImage]);
}

export default usePageMeta;

