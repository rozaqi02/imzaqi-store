import { chromium } from "playwright";
import { readFileSync } from "node:fs";

async function main() {
  const geminiImg = "data:image/png;base64," + readFileSync("C:/Users/rojak/.gemini/antigravity/brain/bff39e6e-c087-4944-aacf-326cc854dfa1/db_icons/gemini.png").toString("base64");
  const turnitinImg = "data:image/png;base64," + readFileSync("C:/Users/rojak/.gemini/antigravity/brain/bff39e6e-c087-4944-aacf-326cc854dfa1/db_icons/turnitin.png").toString("base64");
  const chatgptImg = "data:image/jpeg;base64," + readFileSync("C:/Users/rojak/.gemini/antigravity/brain/bff39e6e-c087-4944-aacf-326cc854dfa1/db_icons/chatgpt.jpg").toString("base64");
  const canvaImg = "data:image/png;base64," + readFileSync("C:/Users/rojak/.gemini/antigravity/brain/bff39e6e-c087-4944-aacf-326cc854dfa1/db_icons/canva.png").toString("base64");
  const youtubeImg = "data:image/png;base64," + readFileSync("C:/Users/rojak/.gemini/antigravity/brain/bff39e6e-c087-4944-aacf-326cc854dfa1/db_icons/youtube.png").toString("base64");

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800;900&display=swap" rel="stylesheet">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
      body {
        width: 1200px;
        height: 630px;
        background: #060b11;
        overflow: hidden;
        position: relative;
        color: #fff;
      }

      /* Ambient Atmospheric Glows */
      .glow-emerald {
        position: absolute;
        top: -80px;
        right: 120px;
        width: 650px;
        height: 650px;
        background: radial-gradient(circle, rgba(16, 185, 129, 0.32) 0%, rgba(6, 182, 212, 0.14) 40%, transparent 70%);
        filter: blur(20px);
        pointer-events: none;
      }
      .glow-cyan {
        position: absolute;
        bottom: -120px;
        left: -60px;
        width: 500px;
        height: 500px;
        background: radial-gradient(circle, rgba(6, 182, 212, 0.22) 0%, transparent 65%);
        filter: blur(30px);
        pointer-events: none;
      }

      /* Main Layout */
      .layout {
        position: relative;
        z-index: 10;
        width: 1200px;
        height: 630px;
        padding: 55px 75px 45px 75px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }

      .top-section {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 440px;
      }

      /* Hero Brand Typography */
      .hero-text {
        max-width: 520px;
      }
      .brand-title {
        font-size: 80px;
        font-weight: 900;
        line-height: 0.98;
        letter-spacing: -0.04em;
        text-transform: uppercase;
        color: #ffffff;
        text-shadow: 0 4px 30px rgba(0, 0, 0, 0.6);
      }
      .brand-subtitle {
        margin-top: 26px;
        font-size: 26px;
        font-weight: 700;
        line-height: 1.35;
        color: #e2e8f0;
        letter-spacing: -0.015em;
      }
      .brand-subtitle .sub-highlight {
        color: #10b981;
        display: block;
        font-weight: 800;
        text-shadow: 0 0 20px rgba(16, 185, 129, 0.4);
      }

      /* 3D Isometric Cluster Container */
      .stage-3d {
        position: relative;
        width: 540px;
        height: 440px;
      }
      .cluster {
        position: absolute;
        right: 10px;
        top: 15px;
        width: 520px;
        height: 420px;
        transform: rotate(-13deg) skewX(-3.5deg);
        transform-origin: center center;
      }

      /* 3D Glass Tiles */
      .tile {
        position: absolute;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 32px;
        box-shadow: 
          0 22px 45px rgba(0, 0, 0, 0.82),
          0 8px 16px rgba(0, 0, 0, 0.5),
          inset 0 3px 5px rgba(255, 255, 255, 0.45),
          inset 0 -4px 6px rgba(0, 0, 0, 0.6);
        border: 2.5px solid rgba(255, 255, 255, 0.28);
        overflow: hidden;
      }
      .tile::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.06) 35%, transparent 60%);
        pointer-events: none;
        border-radius: inherit;
        z-index: 5;
      }

      /* Netflix */
      .t-netflix {
        left: 20px;
        top: 25px;
        width: 135px;
        height: 135px;
        background: #090c12;
        box-shadow: 0 22px 45px rgba(0,0,0,0.85), 0 0 30px rgba(229, 9, 20, 0.3);
      }
      .t-netflix svg {
        width: 78px;
        height: 78px;
      }

      /* Spotify */
      .t-spotify {
        left: 175px;
        top: 0px;
        width: 140px;
        height: 140px;
        background: radial-gradient(circle at 35% 35%, #10b981 0%, #064e3b 100%);
        box-shadow: 0 22px 45px rgba(0,0,0,0.85), 0 0 35px rgba(16, 185, 129, 0.45);
        border: 2.5px solid rgba(255, 255, 255, 0.4);
      }
      .t-spotify svg {
        width: 82px;
        height: 82px;
        fill: #ffffff;
      }

      /* Gemini AI */
      .t-gemini {
        left: 335px;
        top: 30px;
        width: 140px;
        height: 140px;
        background: radial-gradient(circle at 30% 30%, #172033 0%, #080c14 100%);
        box-shadow: 0 22px 45px rgba(0,0,0,0.85), 0 0 35px rgba(99, 102, 241, 0.4);
      }
      .t-gemini canvas {
        width: 105px;
        height: 105px;
        filter: drop-shadow(0 4px 14px rgba(99, 102, 241, 0.7));
      }

      /* ChatGPT (modern white on sleek dark) */
      .t-chatgpt {
        left: 50px;
        top: 185px;
        width: 140px;
        height: 140px;
        background: radial-gradient(circle at 30% 30%, #1e293b 0%, #090d16 100%);
        box-shadow: 0 22px 45px rgba(0,0,0,0.85), 0 0 30px rgba(16, 185, 129, 0.25);
      }
      .t-chatgpt img {
        width: 90px;
        height: 90px;
        object-fit: contain;
        filter: invert(1) drop-shadow(0 2px 8px rgba(255,255,255,0.4));
      }

      /* Canva Pro */
      .t-canva {
        left: 205px;
        top: 160px;
        width: 145px;
        height: 145px;
        background: radial-gradient(circle at 30% 30%, #00c4cc 0%, #7d2ae8 100%);
        box-shadow: 0 22px 45px rgba(0,0,0,0.85), 0 0 35px rgba(0, 196, 204, 0.45);
      }
      .t-canva img {
        width: 100px;
        height: 100px;
        object-fit: contain;
      }

      /* Turnitin (official blue portal) */
      .t-turnitin {
        left: 365px;
        top: 190px;
        width: 140px;
        height: 140px;
        background: #ffffff;
        box-shadow: 0 22px 45px rgba(0,0,0,0.75), 0 0 30px rgba(2, 132, 199, 0.3);
        border: 2.5px solid rgba(255, 255, 255, 0.95);
      }
      .t-turnitin img {
        width: 140px;
        height: 140px;
        object-fit: contain;
        transform: scale(1.7);
        filter: drop-shadow(0 2px 6px rgba(0,0,0,0.15));
      }

      /* YouTube */
      .t-youtube {
        left: 190px;
        top: 325px;
        width: 140px;
        height: 110px;
        background: radial-gradient(circle at 30% 30%, #2a1114 0%, #0e0507 100%);
        box-shadow: 0 22px 45px rgba(0,0,0,0.85), 0 0 30px rgba(255, 0, 0, 0.35);
      }
      .t-youtube img {
        width: 82px;
        height: 82px;
        object-fit: contain;
      }

      /* Bottom Bar */
      .bottom-bar {
        position: relative;
        padding-top: 22px;
      }
      .divider-line {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 1.5px;
        background: linear-gradient(90deg, #10b981 0%, #06b6d4 45%, rgba(6, 182, 212, 0.05) 100%);
        box-shadow: 0 0 14px rgba(16, 185, 129, 0.7);
      }
      .pills-row {
        display: flex;
        gap: 18px;
        align-items: center;
      }
      .pill {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 24px;
        border-radius: 999px;
        background: rgba(13, 24, 38, 0.7);
        border: 1px solid rgba(52, 211, 153, 0.4);
        backdrop-filter: blur(14px);
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.45), inset 0 1px 2px rgba(255, 255, 255, 0.12);
      }
      .pill-icon {
        font-size: 18px;
      }
      .pill-text {
        font-size: 17px;
        font-weight: 700;
        color: #f1f5f9;
        letter-spacing: -0.01em;
      }
    </style>
  </head>
  <body>
    <div class="glow-emerald"></div>
    <div class="glow-cyan"></div>

    <div class="layout">
      <!-- Top Section -->
      <div class="top-section">
        <div class="hero-text">
          <h1 class="brand-title">IMZAQI<br>STORE</h1>
          <p class="brand-subtitle">
            Langganan Premium,
            <span class="sub-highlight">Harga Pelajar</span>
          </p>
        </div>

        <!-- 3D Isometric Cluster -->
        <div class="stage-3d">
          <div class="cluster">
            <!-- Netflix -->
            <div class="tile t-netflix">
              <svg viewBox="0 0 407 407">
                <path fill="#e50914" d="M115 0h60l70 200V0h60v407h-60l-70-200v200h-60z"/>
              </svg>
            </div>

            <!-- Spotify -->
            <div class="tile t-spotify">
              <svg viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.563.387-.857.207-2.35-1.436-5.308-1.76-8.792-.963-.335.077-.67-.133-.747-.468-.077-.334.133-.67.468-.747 3.808-.87 7.076-.505 9.72 1.115.295.18.388.563.208.856zm1.224-2.72c-.227.368-.71.485-1.078.258-2.69-1.654-6.79-2.133-9.972-1.168-.413.125-.852-.107-.977-.52-.125-.413.107-.852.52-.977 3.633-1.103 8.147-.568 11.25 1.34.368.226.485.71.257 1.067zm.105-2.835C14.692 9.074 9.375 8.895 6.29 9.83c-.494.15-1.018-.13-1.168-.624-.15-.493.13-1.018.624-1.168 3.532-1.072 9.404-.866 13.115 1.336.444.263.59.84.327 1.284-.264.444-.84.59-1.272.31z"/>
              </svg>
            </div>

            <!-- Gemini AI -->
            <div class="tile t-gemini">
              <canvas id="gemini-cvs" width="200" height="200"></canvas>
            </div>

            <!-- ChatGPT (modern white) -->
            <div class="tile t-chatgpt">
              <img src="${chatgptImg}" />
            </div>

            <!-- Canva Pro -->
            <div class="tile t-canva">
              <img src="${canvaImg}" />
            </div>

            <!-- Turnitin (authentic official blue) -->
            <div class="tile t-turnitin">
              <img src="${turnitinImg}" />
            </div>

            <!-- YouTube -->
            <div class="tile t-youtube">
              <img src="${youtubeImg}" />
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Badges -->
      <div class="bottom-bar">
        <div class="divider-line"></div>
        <div class="pills-row">
          <div class="pill">
            <span class="pill-icon">⚡</span>
            <span class="pill-text">Proses Cepat</span>
          </div>
          <div class="pill">
            <span class="pill-icon">💳</span>
            <span class="pill-text">Bayar QRIS Otomatis</span>
          </div>
          <div class="pill">
            <span class="pill-icon">🛡️</span>
            <span class="pill-text">100% Bergaransi</span>
          </div>
        </div>
      </div>
    </div>

    <script>
      const img = new Image();
      img.onload = () => {
        const cvs = document.getElementById("gemini-cvs");
        const ctx = cvs.getContext("2d");
        ctx.drawImage(img, 0, 0, 200, 200);
        const data = ctx.getImageData(0, 0, 200, 200);
        const d = data.data;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i+1], b = d[i+2];
          if (r > 235 && g > 235 && b > 235) {
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
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 2.0,
  });

  await page.setContent(html);
  await new Promise((r) => setTimeout(r, 600));

  const finalPublicPath = "d:/Projek/imzaqi-store/public/og-image.jpg";
  const artifactPath = "C:/Users/rojak/.gemini/antigravity/brain/bff39e6e-c087-4944-aacf-326cc854dfa1/non_ai_og_banner.jpg";

  await page.screenshot({ path: finalPublicPath, type: "jpeg", quality: 95 });
  await page.screenshot({ path: artifactPath, type: "jpeg", quality: 95 });
  await browser.close();

  console.log("Refined non-AI banner generated successfully!");
}

main();
