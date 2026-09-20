import { chromium } from "playwright";
import { readFileSync } from "node:fs";

async function main() {
  const baseImg = "data:image/jpeg;base64," + readFileSync("C:/Users/rojak/.gemini/antigravity/brain/bff39e6e-c087-4944-aacf-326cc854dfa1/og_preview_banner_1789901777999.jpg").toString("base64");
  const geminiImg = "data:image/png;base64," + readFileSync("C:/Users/rojak/.gemini/antigravity/brain/bff39e6e-c087-4944-aacf-326cc854dfa1/db_icons/gemini.png").toString("base64");
  const turnitinImg = "data:image/png;base64," + readFileSync("C:/Users/rojak/.gemini/antigravity/brain/bff39e6e-c087-4944-aacf-326cc854dfa1/db_icons/turnitin.png").toString("base64");
  const chatgptImg = "data:image/jpeg;base64," + readFileSync("C:/Users/rojak/.gemini/antigravity/brain/bff39e6e-c087-4944-aacf-326cc854dfa1/db_icons/chatgpt.jpg").toString("base64");

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
      .base {
        position: absolute;
        inset: 0;
        width: 1376px;
        height: 768px;
      }

      /* 1. Gemini Tile (covers duplicate black Spotify tile at top right) */
      .gemini-overlay {
        position: absolute;
        left: 1208px;
        top: 240px;
        width: 180px;
        height: 180px;
        transform: rotate(18.5deg) skewX(2deg);
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 46px;
        background: #0b0f19;
        box-shadow: 
          0 16px 36px rgba(0,0,0,0.85),
          0 0 25px rgba(66, 133, 244, 0.35),
          inset 0 3px 5px rgba(255,255,255,0.35),
          inset 0 -4px 6px rgba(0,0,0,0.6);
        border: 2.5px solid rgba(255,255,255,0.28);
        overflow: hidden;
        z-index: 10;
      }
      .gemini-overlay canvas {
        width: 130px;
        height: 130px;
        filter: drop-shadow(0 4px 12px rgba(66, 133, 244, 0.7));
      }

      /* 2. ChatGPT Tile (covers old green flower tile) */
      .chatgpt-overlay {
        position: absolute;
        left: 735px;
        top: 280px;
        width: 230px;
        height: 230px;
        transform: rotate(18.5deg) skewX(2deg);
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 56px;
        background: radial-gradient(circle at 30% 30%, #17202c 0%, #070a0f 100%);
        box-shadow: 
          0 18px 40px rgba(0,0,0,0.88),
          0 0 25px rgba(0, 214, 180, 0.2),
          inset 0 3px 5px rgba(255,255,255,0.4),
          inset 0 -4px 6px rgba(0,0,0,0.65);
        border: 2.5px solid rgba(255,255,255,0.28);
        z-index: 5;
      }
      .chatgpt-overlay img {
        width: 150px;
        height: 150px;
        object-fit: contain;
        filter: invert(1) drop-shadow(0 2px 8px rgba(255,255,255,0.35));
      }

      /* 3. Turnitin Tile (covers shield tile at bottom right) */
      .turnitin-overlay {
        position: absolute;
        left: 1205px;
        top: 405px;
        width: 225px;
        height: 225px;
        transform: rotate(18.5deg) skewX(2deg);
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 56px;
        background: #ffffff;
        box-shadow: 
          0 20px 42px rgba(0,0,0,0.8),
          0 0 20px rgba(2, 132, 199, 0.25),
          inset 0 4px 6px rgba(255,255,255,0.95),
          inset 0 -3px 6px rgba(0,0,0,0.18);
        border: 2.5px solid rgba(255,255,255,0.95);
        overflow: hidden;
        z-index: 8;
      }
      .turnitin-overlay img {
        width: 155px;
        height: 155px;
        object-fit: contain;
        filter: drop-shadow(0 2px 6px rgba(0,0,0,0.1));
      }
    </style>
  </head>
  <body>
    <img class="base" src="${baseImg}" />
    
    <div class="gemini-overlay">
      <canvas id="gemini-cvs" width="300" height="300"></canvas>
    </div>
    
    <div class="chatgpt-overlay">
      <img src="${chatgptImg}" />
    </div>
    
    <div class="turnitin-overlay">
      <img src="${turnitinImg}" />
    </div>

    <script>
      const img = new Image();
      img.onload = () => {
        const cvs = document.getElementById("gemini-cvs");
        const ctx = cvs.getContext("2d");
        ctx.drawImage(img, 0, 0, 300, 300);
        const data = ctx.getImageData(0, 0, 300, 300);
        const d = data.data;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i+1], b = d[i+2];
          if (r > 240 && g > 240 && b > 240) {
            d[i+3] = 0;
          }
        }
        ctx.putImageData(data, 0, 0);
      };
      img.src = "${geminiImg}";
    </script>
  </body>
  </html>
  `;

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1376, height: 768 },
    deviceScaleFactor: 2.0,
  });

  await page.setContent(html);
  await new Promise((r) => setTimeout(r, 600));

  const finalPublicPath = "d:/Projek/imzaqi-store/public/og-image.jpg";
  const artifactPath = "C:/Users/rojak/.gemini/antigravity/brain/bff39e6e-c087-4944-aacf-326cc854dfa1/final_og_preview.jpg";

  await page.screenshot({ path: finalPublicPath, type: "jpeg", quality: 95 });
  await page.screenshot({ path: artifactPath, type: "jpeg", quality: 95 });
  await browser.close();

  console.log("Rendered successfully!");
}

main();
