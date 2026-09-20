import { chromium } from "playwright";
import { readFile } from "node:fs/promises";

async function fetchAsBase64(url) {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") || "image/png";
  return `data:${contentType};base64,${Buffer.from(buffer).toString("base64")}`;
}

async function main() {
  const baseImgBuffer = await readFile("C:/Users/rojak/.gemini/antigravity/brain/bff39e6e-c087-4944-aacf-326cc854dfa1/og_preview_banner_1789901777999.jpg");
  const baseImgBase64 = `data:image/jpeg;base64,${baseImgBuffer.toString("base64")}`;

  console.log("Fetching database icons...");
  const [geminiData, chatgptData, turnitinData] = await Promise.all([
    fetchAsBase64("https://vusrfbkjeorsaremzsim.supabase.co/storage/v1/object/public/product-icons/icons/1788705509659-4e11976062cf.png"),
    fetchAsBase64("https://vusrfbkjeorsaremzsim.supabase.co/storage/v1/object/public/product-icons/icons/1774611114451-ac7b48b14baf2.jpg"),
    fetchAsBase64("https://vusrfbkjeorsaremzsim.supabase.co/storage/v1/object/public/product-icons/icons/1785298819374-4f5214bb06e8f8.png"),
  ]);

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        width: 1376px;
        height: 768px;
        background: #000;
        overflow: hidden;
        position: relative;
      }
      .base-bg {
        width: 1376px;
        height: 768px;
        display: block;
        position: absolute;
        inset: 0;
      }

      /* 3D Glass Tile Style matching original render */
      .glass-tile {
        position: absolute;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
      }

      /* 1. ChatGPT Tile (covers green flower tile) */
      .tile-chatgpt {
        left: 720px;
        top: 415px;
        width: 250px;
        height: 250px;
        transform: rotate(-15deg) skewX(-2.5deg);
        border-radius: 60px;
        background: #080c14;
        box-shadow: 
          0 22px 45px rgba(0, 0, 0, 0.85),
          0 0 30px rgba(0, 214, 180, 0.22),
          inset 0 4px 4px rgba(255, 255, 255, 0.45),
          inset 0 -5px 8px rgba(0, 0, 0, 0.7);
        border: 4px solid rgba(255, 255, 255, 0.32);
      }
      .tile-chatgpt img {
        width: 175px;
        height: 175px;
        border-radius: 40px;
        object-fit: cover;
      }
      .tile-chatgpt::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0.05) 35%, transparent 60%);
        pointer-events: none;
        border-radius: 60px;
      }

      /* 2. Gemini AI Tile (replaces duplicate Spotify on far right) */
      .tile-gemini {
        left: 1175px;
        top: 220px;
        width: 235px;
        height: 235px;
        transform: rotate(17deg) skewX(2.5deg);
        border-radius: 56px;
        background: #09101d;
        box-shadow: 
          0 24px 50px rgba(0, 0, 0, 0.85),
          0 0 35px rgba(99, 102, 241, 0.4),
          inset 0 4px 4px rgba(255, 255, 255, 0.45),
          inset 0 -5px 8px rgba(0, 0, 0, 0.7);
        border: 4px solid rgba(255, 255, 255, 0.32);
      }
      .tile-gemini img {
        width: 168px;
        height: 168px;
        border-radius: 36px;
        object-fit: cover;
      }
      .tile-gemini::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.38) 0%, rgba(255, 255, 255, 0.08) 38%, transparent 60%);
        pointer-events: none;
        border-radius: 56px;
      }

      /* 3. Turnitin Tile (replaces hallucinated shield logo) */
      .tile-turnitin {
        left: 1095px;
        top: 475px;
        width: 265px;
        height: 265px;
        transform: rotate(15deg) skewX(2deg);
        border-radius: 64px;
        background: #ffffff;
        box-shadow: 
          0 24px 50px rgba(0, 0, 0, 0.75),
          0 0 30px rgba(2, 132, 199, 0.25),
          inset 0 4px 4px rgba(255, 255, 255, 0.95),
          inset 0 -5px 8px rgba(0, 0, 0, 0.3);
        border: 4px solid rgba(255, 255, 255, 0.95);
      }
      .tile-turnitin img {
        width: 195px;
        height: 195px;
        border-radius: 40px;
        object-fit: contain;
      }
      .tile-turnitin::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0.12) 40%, transparent 60%);
        pointer-events: none;
        border-radius: 64px;
      }
    </style>
  </head>
  <body>
    <img class="base-bg" src="${baseImgBase64}" />

    <!-- Overlays snapping exactly on target tiles -->
    <div class="glass-tile tile-chatgpt">
      <img src="${chatgptData}" alt="ChatGPT">
    </div>

    <div class="glass-tile tile-gemini">
      <img src="${geminiData}" alt="Gemini">
    </div>

    <div class="glass-tile tile-turnitin">
      <img src="${turnitinData}" alt="Turnitin">
    </div>
  </body>
  </html>
  `;

  console.log("Rendering composite banner...");
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1376, height: 768 },
    deviceScaleFactor: 1.5,
  });

  await page.setContent(html);
  await new Promise((r) => setTimeout(r, 400));

  const testPath = "C:/Users/rojak/.gemini/antigravity/brain/bff39e6e-c087-4944-aacf-326cc854dfa1/test_composite.jpg";
  await page.screenshot({ path: testPath, type: "jpeg", quality: 95 });
  await browser.close();
  console.log("Rendered test composite to:", testPath);
}

main().catch(console.error);
