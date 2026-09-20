import { chromium } from "playwright";
import { readFile } from "node:fs/promises";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1376, height: 768 } });
  
  const imgBuffer = await readFile("C:/Users/rojak/.gemini/antigravity/brain/bff39e6e-c087-4944-aacf-326cc854dfa1/og_preview_banner_1789901777999.jpg");
  const imgBase64 = `data:image/jpeg;base64,${imgBuffer.toString("base64")}`;

  const verticalLines = Array.from({ length: 14 }, (_, i) => 
    `<line x1="${i * 100}" y1="0" x2="${i * 100}" y2="768" stroke="rgba(255,0,0,0.5)" stroke-width="1" />
     <text x="${i * 100 + 4}" y="20" fill="red" font-size="12" font-family="sans-serif">${i * 100}</text>`
  ).join("");

  const horizontalLines = Array.from({ length: 8 }, (_, i) => 
    `<line x1="0" y1="${i * 100}" x2="1376" y2="${i * 100}" stroke="rgba(0,255,0,0.5)" stroke-width="1" />
     <text x="4" y="${i * 100 + 16}" fill="lime" font-size="12" font-family="sans-serif">${i * 100}</text>`
  ).join("");

  const html = `
    <body style="margin: 0; padding: 0; background: #000;">
      <div style="position: relative; width: 1376px; height: 768px;">
        <img src="${imgBase64}" style="width: 1376px; height: 768px; display: block;" />
        <svg style="position: absolute; inset: 0; width: 1376px; height: 768px; pointer-events: none;">
          ${verticalLines}
          ${horizontalLines}
        </svg>
      </div>
    </body>
  `;

  await page.setContent(html);
  await page.screenshot({ path: "C:/Users/rojak/.gemini/antigravity/brain/bff39e6e-c087-4944-aacf-326cc854dfa1/grid_check.jpg" });
  await browser.close();
  console.log("Grid check created successfully");
}

main();
