import { chromium } from "playwright";
import { readFileSync } from "node:fs";

async function main() {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1376, height: 768 } });
  
  const baseImg = "data:image/jpeg;base64," + readFileSync("C:/Users/rojak/.gemini/antigravity/brain/bff39e6e-c087-4944-aacf-326cc854dfa1/og_preview_banner_1789901777999.jpg").toString("base64");
  
  const html = `
    <body style="margin:0; background:#000;">
      <div style="position:relative; width:1376px; height:768px;">
        <img src="${baseImg}" style="width:1376px; height:768px; display:block;" />
        <svg style="position:absolute; inset:0; width:1376px; height:768px;">
          <!-- ChatGPT corners -->
          <!-- Top, Right, Bottom, Left -->
          <polygon id="poly-chatgpt" points="840,425 930,590 805,675 718,505" fill="rgba(255,0,0,0.35)" stroke="red" stroke-width="2" />
          
          <!-- Spotify#2 (Gemini) corners -->
          <polygon id="poly-gemini" points="1275,230 1365,395 1240,485 1150,315" fill="rgba(0,255,0,0.35)" stroke="lime" stroke-width="2" />
          
          <!-- Turnitin corners -->
          <polygon id="poly-turnitin" points="1225,480 1325,650 1195,745 1095,570" fill="rgba(0,180,255,0.35)" stroke="cyan" stroke-width="2" />
        </svg>
      </div>
    </body>
  `;
  await p.setContent(html);
  await p.screenshot({ path: "C:/Users/rojak/.gemini/antigravity/brain/bff39e6e-c087-4944-aacf-326cc854dfa1/box_check.jpg" });
  await b.close();
  console.log("box_check.jpg created");
}

main();
