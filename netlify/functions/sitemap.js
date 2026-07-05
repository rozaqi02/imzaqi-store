const SITE_URL = "https://imzaqistore.my.id";

exports.handler = async () => {
  const staticPaths = ["/", "/produk", "/tentang", "/testimoni", "/status", "/faq", "/bayar"];

  let productPaths = [];
  try {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    if (url && key) {
      const res = await fetch(
        `${url}/rest/v1/products?select=slug,updated_at&is_active=eq.true&order=sort_order.asc`,
        {
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
          },
        }
      );
      if (res.ok) {
        const rows = await res.json();
        productPaths = (rows || []).map((row) => `/produk/${row.slug}`);
      }
    }
  } catch {}

  const all = [...staticPaths, ...productPaths];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${all
    .map((path) => `  <url><loc>${SITE_URL}${path}</loc></url>`)
    .join("\n")}\n</urlset>`;

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
    body,
  };
};