import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadEnv } from "vite";
import { PRODUCT_SCHEMA_ID, productStructuredData } from "../src/lib/productStructuredData.mjs";

const siteUrl = "https://imzaqi.store";
const distDir = resolve("dist");
const templatePath = resolve(distDir, "index.html");
const buildEnv = { ...loadEnv("production", process.cwd(), ""), ...process.env };
const supabaseUrl = buildEnv.VITE_SUPABASE_URL || buildEnv.SUPABASE_URL;
const supabaseKey = buildEnv.VITE_SUPABASE_ANON_KEY || buildEnv.SUPABASE_ANON_KEY;

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function replaceMeta(html, product) {
  const title = `${product.name} - Imzaqi Store`;
  const description = product.description || `Beli ${product.name} di Imzaqi Store. Bayar QRIS dan bergaransi.`;
  const canonical = `${siteUrl}/produk/${encodeURIComponent(product.slug)}`;
  const image = product.icon_url || `${siteUrl}/og-image.jpg`;
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta\s+name="description"[\s\S]*?\/>/, `<meta name="description" content="${escapeHtml(description)}" />`)
    .replace(/<meta property="og:title"[^>]*\/>/, `<meta property="og:title" content="${escapeHtml(title)}" />`)
    .replace(/<meta\s+property="og:description"[\s\S]*?\/>/, `<meta property="og:description" content="${escapeHtml(description)}" />`)
    .replace(/<meta property="og:url"[^>]*\/>/, `<meta property="og:url" content="${canonical}" />`)
    .replace(/<meta property="og:image"[^>]*\/>/, `<meta property="og:image" content="${escapeHtml(image)}" />`)
    .replace(/<meta name="twitter:title"[^>]*\/>/, `<meta name="twitter:title" content="${escapeHtml(title)}" />`)
    .replace(/<meta\s+name="twitter:description"[\s\S]*?\/>/, `<meta name="twitter:description" content="${escapeHtml(description)}" />`)
    .replace(/<meta name="twitter:image"[^>]*\/>/, `<meta name="twitter:image" content="${escapeHtml(image)}" />`)
    .replace("</head>", `  <link rel="canonical" href="${canonical}" />\n  <script id="${PRODUCT_SCHEMA_ID}" type="application/ld+json">${JSON.stringify(productStructuredData(product)).replaceAll("<", "\\u003c")}</script>\n  </head>`);
}

async function main() {
  if (!supabaseUrl || !supabaseKey) {
    console.log("Product prerender skipped: Supabase build variables are unavailable.");
    return;
  }
  const response = await fetch(
    `${supabaseUrl}/rest/v1/products?select=slug,name,description,icon_url&is_active=eq.true`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
  );
  if (!response.ok) throw new Error(`Product prerender failed: HTTP ${response.status}`);
  const [template, products] = await Promise.all([readFile(templatePath, "utf8"), response.json()]);
  const safeProducts = (products || []).filter((product) => /^[a-z0-9-]+$/i.test(String(product.slug || "")));
  await Promise.all(safeProducts.map(async (product) => {
    const outputDir = resolve(distDir, "produk", product.slug);
    await mkdir(outputDir, { recursive: true });
    await writeFile(resolve(outputDir, "index.html"), replaceMeta(template, product), "utf8");
  }));
  console.log(`Prerendered ${safeProducts.length} product pages.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
