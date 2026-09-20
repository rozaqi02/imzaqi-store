import { writeFileSync, existsSync, mkdirSync } from "node:fs";

const icons = {
  netflix: "https://vusrfbkjeorsaremzsim.supabase.co/storage/v1/object/public/product-icons/icons/1774611336862-d23587d6a1e338.jpg",
  spotify: "https://vusrfbkjeorsaremzsim.supabase.co/storage/v1/object/public/product-icons/icons/1774611390110-8b388f54df743.png",
  canva: "https://vusrfbkjeorsaremzsim.supabase.co/storage/v1/object/public/product-icons/icons/1788706009795-5f92b73bf4a5a8.png",
  chatgpt: "https://vusrfbkjeorsaremzsim.supabase.co/storage/v1/object/public/product-icons/icons/1774611114451-ac7b48b14baf2.jpg",
  youtube: "https://vusrfbkjeorsaremzsim.supabase.co/storage/v1/object/public/product-icons/icons/1785299172792-5f490ebbaa197.png",
  gemini: "https://vusrfbkjeorsaremzsim.supabase.co/storage/v1/object/public/product-icons/icons/1788705509659-4e11976062cf.png",
  turnitin: "https://vusrfbkjeorsaremzsim.supabase.co/storage/v1/object/public/product-icons/icons/1785298819374-4f5214bb06e8f8.png"
};

async function downloadAll() {
  const dir = "C:/Users/rojak/.gemini/antigravity/brain/bff39e6e-c087-4944-aacf-326cc854dfa1/db_icons";
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  for (const [name, url] of Object.entries(icons)) {
    const res = await fetch(url);
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = url.endsWith(".png") ? "png" : "jpg";
    const path = `${dir}/${name}.${ext}`;
    writeFileSync(path, buf);
    console.log(`Downloaded ${name}.${ext} (${buf.length} bytes) to ${path}`);
  }
}
downloadAll();
