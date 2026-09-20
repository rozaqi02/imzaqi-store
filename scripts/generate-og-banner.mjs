import { chromium } from "playwright";
import { resolve } from "node:path";

// Database icon URLs
const ICONS = {
  netflix: "https://vusrfbkjeorsaremzsim.supabase.co/storage/v1/object/public/product-icons/icons/1774611336862-d23587d6a1e338.jpg",
  spotify: "https://vusrfbkjeorsaremzsim.supabase.co/storage/v1/object/public/product-icons/icons/1774611390110-8b388f54df743.png",
  canva: "https://vusrfbkjeorsaremzsim.supabase.co/storage/v1/object/public/product-icons/icons/1788706009795-5f92b73bf4a5a8.png",
  chatgpt: "https://vusrfbkjeorsaremzsim.supabase.co/storage/v1/object/public/product-icons/icons/1774611114451-ac7b48b14baf2.jpg",
  youtube: "https://vusrfbkjeorsaremzsim.supabase.co/storage/v1/object/public/product-icons/icons/1785299172792-5f490ebbaa197.png",
  gemini: "https://vusrfbkjeorsaremzsim.supabase.co/storage/v1/object/public/product-icons/icons/1788705509659-4e11976062cf.png",
  turnitin: "https://vusrfbkjeorsaremzsim.supabase.co/storage/v1/object/public/product-icons/icons/1785298819374-4f5214bb06e8f8.png",
  capcut: "https://vusrfbkjeorsaremzsim.supabase.co/storage/v1/object/public/product-icons/icons/1769331428270-4bfd91e7216cc8.jpeg",
};

async function fetchAsBase64(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "image/png";
    return `data:${contentType};base64,${Buffer.from(buffer).toString("base64")}`;
  } catch (err) {
    console.error(`Failed to fetch ${url}:`, err.message);
    return url;
  }
}

async function main() {
  console.log("Fetching database icons...");
  const [
    netflixData,
    spotifyData,
    canvaData,
    chatgptData,
    youtubeData,
    geminiData,
    turnitinData,
    capcutData,
  ] = await Promise.all([
    fetchAsBase64(ICONS.netflix),
    fetchAsBase64(ICONS.spotify),
    fetchAsBase64(ICONS.canva),
    fetchAsBase64(ICONS.chatgpt),
    fetchAsBase64(ICONS.youtube),
    fetchAsBase64(ICONS.gemini),
    fetchAsBase64(ICONS.turnitin),
    fetchAsBase64(ICONS.capcut),
  ]);

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@800;900&family=Plus+Jakarta+Sans:wght@500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      width: 1200px;
      height: 675px;
      background: #04080e;
      font-family: 'Plus Jakarta Sans', sans-serif;
      color: #f8fafc;
      overflow: hidden;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 60px 80px;
    }

    /* Radiant Imzaqi Green Ambient Glows */
    .bg-ambient-1 {
      position: absolute;
      top: -80px;
      right: 40px;
      width: 680px;
      height: 680px;
      background: radial-gradient(circle, rgba(0, 214, 180, 0.32) 0%, rgba(0, 168, 107, 0.18) 40%, rgba(4, 30, 24, 0.05) 70%, transparent 80%);
      filter: blur(55px);
      pointer-events: none;
    }
    .bg-ambient-2 {
      position: absolute;
      bottom: -100px;
      left: -60px;
      width: 620px;
      height: 620px;
      background: radial-gradient(circle, rgba(0, 214, 180, 0.22) 0%, rgba(0, 158, 96, 0.12) 45%, transparent 75%);
      filter: blur(60px);
      pointer-events: none;
    }
    .bg-ambient-center {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 900px;
      height: 500px;
      background: radial-gradient(ellipse, rgba(0, 194, 208, 0.08) 0%, transparent 70%);
      filter: blur(40px);
      pointer-events: none;
    }
    .bg-grid {
      position: absolute;
      inset: 0;
      background-image: 
        linear-gradient(to right, rgba(0, 214, 180, 0.05) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(0, 214, 180, 0.05) 1px, transparent 1px);
      background-size: 40px 40px;
      mask-image: radial-gradient(ellipse at center, black 50%, transparent 90%);
      pointer-events: none;
    }

    /* Left Column */
    .left-col {
      position: relative;
      z-index: 10;
      max-width: 530px;
      display: flex;
      flex-direction: column;
      gap: 22px;
    }

    .brand-title {
      font-family: 'Outfit', sans-serif;
      font-size: 72px;
      font-weight: 900;
      line-height: 1.02;
      letter-spacing: -0.025em;
      background: linear-gradient(180deg, #ffffff 0%, #f1f5f9 60%, #cbd5e1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      filter: drop-shadow(0 6px 24px rgba(0, 0, 0, 0.8));
    }

    .brand-tagline {
      font-size: 23px;
      font-weight: 600;
      line-height: 1.48;
      color: #94a3b8;
      letter-spacing: -0.01em;
    }

    .brand-tagline strong {
      color: #00f5c4;
      font-weight: 800;
      text-shadow: 0 0 20px rgba(0, 245, 196, 0.45);
    }

    .trust-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 10px;
    }

    .trust-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      border-radius: 999px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%), #0c141e;
      border: 1px solid rgba(0, 214, 180, 0.22);
      box-shadow: 
        0 10px 24px rgba(0, 0, 0, 0.45),
        inset 0 2px 0 rgba(255, 255, 255, 0.2),
        inset 0 -2px 0 rgba(0, 0, 0, 0.5),
        0 0 12px rgba(0, 214, 180, 0.08);
      font-size: 14px;
      font-weight: 800;
      color: #f1f5f9;
    }

    .trust-pill-icon {
      font-size: 15px;
      color: #00f5c4;
    }

    /* Right Column (Apps Grid) */
    .right-col {
      position: relative;
      z-index: 10;
      display: grid;
      grid-template-columns: repeat(3, 144px);
      gap: 18px;
      transform: perspective(1000px) rotateY(-7deg) rotateX(3deg);
      filter: drop-shadow(0 26px 50px rgba(0, 0, 0, 0.8));
    }

    .app-card {
      width: 144px;
      height: 144px;
      border-radius: 30px;
      padding: 14px;
      background: 
        linear-gradient(180deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.02) 40%, rgba(0, 0, 0, 0.3) 100%),
        #111928;
      border: 1px solid rgba(255, 255, 255, 0.16);
      box-shadow: 
        0 18px 36px rgba(0, 0, 0, 0.55),
        inset 0 3px 0 rgba(255, 255, 255, 0.3),
        inset 0 -3px 0 rgba(0, 0, 0, 0.65);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 9px;
      position: relative;
    }

    .app-card img {
      width: 74px;
      height: 74px;
      border-radius: 18px;
      object-fit: cover;
      box-shadow: 0 8px 22px rgba(0, 0, 0, 0.5);
    }

    .app-card span {
      font-size: 12.5px;
      font-weight: 800;
      color: #e2e8f0;
      text-align: center;
      letter-spacing: -0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }

    /* Staggered offsets for lively 3D floating look */
    .app-card:nth-child(1) { transform: translateY(8px); }
    .app-card:nth-child(2) { transform: translateY(-12px); }
    .app-card:nth-child(3) { transform: translateY(6px); }
    .app-card:nth-child(4) { transform: translateY(16px); }
    .app-card:nth-child(5) { transform: translateY(-4px); }
    .app-card:nth-child(6) { transform: translateY(12px); }

    /* Subtle brand glow on specific cards */
    .app-card.card-netflix { box-shadow: 0 16px 36px rgba(229, 9, 20, 0.28), inset 0 3px 0 rgba(255, 255, 255, 0.3), inset 0 -3px 0 rgba(0, 0, 0, 0.65); }
    .app-card.card-spotify { box-shadow: 0 16px 36px rgba(29, 185, 84, 0.28), inset 0 3px 0 rgba(255, 255, 255, 0.3), inset 0 -3px 0 rgba(0, 0, 0, 0.65); }
    .app-card.card-canva { box-shadow: 0 16px 36px rgba(0, 196, 204, 0.28), inset 0 3px 0 rgba(255, 255, 255, 0.3), inset 0 -3px 0 rgba(0, 0, 0, 0.65); }
    .app-card.card-gemini { box-shadow: 0 16px 36px rgba(99, 102, 241, 0.3), inset 0 3px 0 rgba(255, 255, 255, 0.3), inset 0 -3px 0 rgba(0, 0, 0, 0.65); }
    .app-card.card-turnitin { box-shadow: 0 16px 36px rgba(2, 132, 199, 0.28), inset 0 3px 0 rgba(255, 255, 255, 0.3), inset 0 -3px 0 rgba(0, 0, 0, 0.65); }

    /* Bottom Decorative Glow Line */
    .bottom-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 5px;
      background: linear-gradient(90deg, transparent 0%, #00f5c4 25%, #00a86b 75%, transparent 100%);
      box-shadow: 0 0 20px rgba(0, 245, 196, 0.8);
    }
  </style>
</head>
<body>
  <div class="bg-ambient-1"></div>
  <div class="bg-ambient-2"></div>
  <div class="bg-ambient-center"></div>
  <div class="bg-grid"></div>

  <div class="left-col">
    <h1 class="brand-title">IMZAQI STORE</h1>
    
    <p class="brand-tagline">
      Langganan Premium, <strong>Harga Pelajar</strong>.<br>
      Aman, Legal, dan Bergaransi Penuh.
    </p>

    <div class="trust-strip">
      <div class="trust-pill">
        <span class="trust-pill-icon">⚡</span>
        <span>Proses Cepat 5-30 Mnt</span>
      </div>
      <div class="trust-pill">
        <span class="trust-pill-icon">💳</span>
        <span>Bayar QRIS Otomatis</span>
      </div>
      <div class="trust-pill">
        <span class="trust-pill-icon">🛡️</span>
        <span>Garansi Replace</span>
      </div>
    </div>
  </div>

  <div class="right-col">
    <div class="app-card card-netflix">
      <img src="${netflixData}" alt="Netflix">
      <span>Netflix</span>
    </div>
    <div class="app-card">
      <img src="${chatgptData}" alt="ChatGPT">
      <span>ChatGPT</span>
    </div>
    <div class="app-card card-spotify">
      <img src="${spotifyData}" alt="Spotify">
      <span>Spotify</span>
    </div>
    <div class="app-card card-gemini">
      <img src="${geminiData}" alt="Gemini">
      <span>Gemini AI</span>
    </div>
    <div class="app-card card-canva">
      <img src="${canvaData}" alt="Canva">
      <span>Canva Pro</span>
    </div>
    <div class="app-card card-turnitin">
      <img src="${turnitinData}" alt="Turnitin">
      <span>Turnitin</span>
    </div>
  </div>

  <div class="bottom-bar"></div>
</body>
</html>`;

  console.log("Launching browser to render banner...");
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1200, height: 675 },
    deviceScaleFactor: 2,
  });

  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  
  // Wait a moment for fonts to fully settle
  await new Promise((r) => setTimeout(r, 400));

  const targetPath = resolve("public", "og-image.jpg");
  await page.screenshot({
    path: targetPath,
    type: "jpeg",
    quality: 95,
  });

  await browser.close();
  console.log(`Successfully generated OG banner at: ${targetPath}`);
}

main().catch((err) => {
  console.error("Error generating banner:", err);
  process.exit(1);
});
