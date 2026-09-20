import { chromium } from "playwright";
import { readFileSync } from "node:fs";

async function cropTiles() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1376, height: 768 } });
  
  const baseImg = "data:image/jpeg;base64," + readFileSync("C:/Users/rojak/.gemini/antigravity/brain/bff39e6e-c087-4944-aacf-326cc854dfa1/og_preview_banner_1789901777999.jpg").toString("base64");
  
  await page.setContent(`
    <body style="margin:0; background:#000;">
      <img id="bg" src="${baseImg}" style="position:absolute; left:0; top:0; width:1376px; height:768px;">
    </body>
  `);
  
  const imgDim = await page.evaluate(() => {
    const el = document.getElementById("bg");
    return { naturalW: el.naturalWidth, naturalH: el.naturalHeight, clientW: el.clientWidth, clientH: el.clientHeight };
  });
  console.log("Image dimensions:", imgDim);
  
  // Crop ChatGPT: x 700 to 950, y 400 to 700
  await page.screenshot({ path: "C:/Users/rojak/.gemini/antigravity/brain/bff39e6e-c087-4944-aacf-326cc854dfa1/crop_chatgpt.png", clip: { x: 700, y: 400, width: 250, height: 300 } });
  
  // Crop Spotify #2: x 1150 to 1380, y 210 to 510
  await page.screenshot({ path: "C:/Users/rojak/.gemini/antigravity/brain/bff39e6e-c087-4944-aacf-326cc854dfa1/crop_spotify2.png", clip: { x: 1150, y: 210, width: 226, height: 300 } });
  
  // Crop Turnitin: x 1080 to 1350, y 460 to 770
  await page.screenshot({ path: "C:/Users/rojak/.gemini/antigravity/brain/bff39e6e-c087-4944-aacf-326cc854dfa1/crop_turnitin.png", clip: { x: 1080, y: 460, width: 260, height: 310 } });

  await browser.close();
  console.log("Cropped 3 tiles successfully");
}
cropTiles();
