import { MEDIA_FORMATS, MEDIA_STYLES, chooseVariant, posterOffer } from "./marketingMediaModel.js";

const FONT = '"Plus Jakarta Sans", "Inter", sans-serif';
const money = value => `Rp${new Intl.NumberFormat("id-ID").format(value)}`;

function font(ctx, size, weight = 700) {
  ctx.font = `${weight} ${size}px ${FONT}`;
}

function fit(ctx, text, width, size, weight = 700, min = 18) {
  font(ctx, size, weight);
  while (ctx.measureText(text).width > width && size > min) {
    font(ctx, --size, weight);
  }
  return size;
}

export function wrapText(ctx, text, width, maxLines = 2) {
  const words = String(text).trim().split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  const clipped = lines.length > maxLines;
  const result = lines.slice(0, maxLines);
  if (result.length && (clipped || ctx.measureText(result.at(-1)).width > width)) {
    let tail = result.at(-1);
    while (tail && ctx.measureText(`${tail}…`).width > width) tail = tail.slice(0, -1);
    result[result.length - 1] = `${tail}…`;
  }
  return result;
}

function textBlock(ctx, text, x, y, width, size, maxLines = 2, weight = 700, minSize = 22) {
  font(ctx, size, weight);
  let lines = wrapText(ctx, text, width, 99);
  while (lines.length > maxLines && size > minSize) {
    font(ctx, --size, weight);
    lines = wrapText(ctx, text, width, 99);
  }
  lines = wrapText(ctx, text, width, maxLines);
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * size * 1.15));
  return y + lines.length * size * 1.15;
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, radius);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
}

function drawRoundedBox(ctx, x, y, w, h, radius, { fill, stroke, lineWidth = 1.5, shadowColor, shadowBlur = 0, shadowOffsetY = 0 } = {}) {
  ctx.save();
  if (shadowColor) {
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetY = shadowOffsetY;
  }
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, radius);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  ctx.restore();
}

function fillBackdrop(ctx, width, height, colorTop, colorBottom) {
  ctx.save();
  if (typeof ctx.createLinearGradient === "function") {
    const grad = ctx.createLinearGradient(0, 0, width * 0.4, height);
    grad.addColorStop(0, colorTop);
    grad.addColorStop(1, colorBottom || colorTop);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = colorTop;
  }
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawGlowOrb(ctx, cx, cy, radius, color, alpha = 0.2) {
  ctx.save();
  if (typeof ctx.createRadialGradient === "function") {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, color);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = alpha;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function dotTexture(ctx, width, height, color, step = 46, alpha = 0.08) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  for (let x = step * 0.6; x < width; x += step) {
    for (let y = step * 0.6; y < height; y += step) {
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawChip(ctx, text, x, y, {
  bg,
  borderColor,
  textColor,
  fontSize = 14,
  weight = 700,
  radius = 8,
  padX = 11,
  height = 26,
  align = "left",
}) {
  font(ctx, fontSize, weight);
  const textW = ctx.measureText(text).width;
  const chipW = textW + padX * 2;
  const drawX = align === "right" ? x - chipW : align === "center" ? x - chipW / 2 : x;

  ctx.save();
  ctx.beginPath();
  roundRect(ctx, drawX, y, chipW, height, radius);
  ctx.fillStyle = bg;
  ctx.fill();
  if (borderColor) {
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.25;
    ctx.stroke();
  }
  ctx.fillStyle = textColor;
  font(ctx, fontSize, weight);
  ctx.textAlign = "left";
  ctx.fillText(text, drawX + padX, y + height - Math.round((height - fontSize) * 0.56));
  ctx.restore();
  return chipW;
}

function imageContain(ctx, image, x, y, size) {
  const scale = Math.min(size / image.width, size / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  ctx.drawImage(image, x + (size - w) / 2, y + (size - h) / 2, w, h);
}

function drawSquircleIcon(ctx, image, name, { x, y, size, radius = 24, tileBg = "#ffffff", borderColor, ink = "#143f32", shadow = true, padRatio = 0.06 }) {
  drawRoundedBox(ctx, x, y, size, size, radius, {
    fill: tileBg,
    stroke: borderColor,
    lineWidth: 1.5,
    shadowColor: shadow ? "rgba(0, 0, 0, 0.16)" : undefined,
    shadowBlur: shadow ? 26 : 0,
    shadowOffsetY: shadow ? 12 : 0,
  });

  const pad = Math.round(size * padRatio);
  const innerSize = size - pad * 2;
  const innerRadius = Math.max(8, radius - 4);

  ctx.save();
  if (typeof ctx.clip === "function") {
    ctx.beginPath();
    roundRect(ctx, x + pad, y + pad, innerSize, innerSize, innerRadius);
    ctx.clip();
  }
  if (image) {
    imageContain(ctx, image, x + pad, y + pad, innerSize);
  } else {
    ctx.fillStyle = ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    font(ctx, Math.round(size * 0.44), 800);
    ctx.fillText(String(name || "I").slice(0, 1).toUpperCase(), x + size / 2, y + size / 2);
  }
  ctx.restore();
}

function drawFooterDock(ctx, {
  x,
  y,
  w,
  h,
  bg,
  ink,
  accent,
  qr,
  phone,
  catalog = false,
  footerMode = "standard",
  borderColor = "rgba(255, 255, 255, 0.14)",
}) {
  drawRoundedBox(ctx, x, y, w, h, 26, {
    fill: bg,
    stroke: borderColor,
    lineWidth: 1.5,
    shadowColor: "rgba(0, 0, 0, 0.22)",
    shadowBlur: 28,
    shadowOffsetY: 12,
  });

  const padX = Math.max(28, Math.round(h * 0.22));
  const qrSize = Math.min(136, h - 28);
  const qrBoxSize = qrSize;
  const textRightBound = qr ? w - qrBoxSize - padX * 2 - 20 : w - padX * 2;

  ctx.save();
  ctx.textAlign = "left";
  ctx.fillStyle = accent;
  font(ctx, 15, 800);
  ctx.fillText(catalog ? "TEMUKAN PAKETMU DI" : "PILIH PAKET. LANJUT CHECKOUT.", x + padX, y + Math.round(h * 0.29));

  ctx.fillStyle = ink;
  font(ctx, h >= 180 ? 38 : 32, 800);
  ctx.fillText("imzaqi.store", x + padX, y + Math.round(h * 0.58));

  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.8;
  const subCopy =
    footerMode === "reseller"
      ? "scan QR untuk lihat stok terbaru & hubungi admin"
      : phone
        ? `Tanya admin · +${phone}`
        : "Scan QR untuk lihat produk & stok terbaru";
  fit(ctx, subCopy, textRightBound, h >= 180 ? 20 : 18, 600, 14);
  ctx.fillText(subCopy, x + padX, y + Math.round(h * 0.8));
  ctx.restore();

  if (qr) {
    const qx = x + w - qrBoxSize - Math.round((h - qrBoxSize) / 2);
    const qy = y + Math.round((h - qrBoxSize) / 2);
    drawRoundedBox(ctx, qx, qy, qrBoxSize, qrBoxSize, 16, {
      fill: "#ffffff",
      shadowColor: "rgba(0, 0, 0, 0.18)",
      shadowBlur: 12,
      shadowOffsetY: 4,
    });
    const innerPad = Math.max(6, Math.round(qrBoxSize * 0.06));
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qr, qx + innerPad, qy + innerPad, qrBoxSize - innerPad * 2, qrBoxSize - innerPad * 2);
    ctx.restore();
  }
}

function drawShowcaseCard(ctx, style, { x, y, w, h, image, offer, variation, radius = 34 }) {
  const mode = variation % 3;
  drawRoundedBox(ctx, x, y, w, h, radius, {
    fill: style.cardBg,
    stroke: style.cardBorder,
    lineWidth: 2,
    shadowColor: "rgba(0, 0, 0, 0.14)",
    shadowBlur: 36,
    shadowOffsetY: 16,
  });

  // Subtle decorative spotlight inside the showcase card
  const cx = x + w / 2;
  const cy = y + h / 2;
  drawGlowOrb(ctx, cx, cy, Math.min(w, h) * 0.56, style.accent, 0.24);
  drawGlowOrb(ctx, x + w * 0.8, y + h * 0.2, Math.min(w, h) * 0.3, style.secondary, 0.2);

  // Subtle geometric ring backdrop behind logo
  ctx.save();
  ctx.strokeStyle = style.accent;
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.min(w, h) * (mode === 1 ? 0.36 : 0.39), 0, Math.PI * 2);
  ctx.stroke();
  if (mode !== 0) {
    ctx.globalAlpha = 0.14;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(w, h) * 0.44, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  const iconSize = Math.round(Math.min(w, h) * 0.56);
  const tilt = mode === 0 ? -0.04 : mode === 1 ? 0.045 : 0;

  const isYoutube = /youtube/i.test(`${offer.slug || ""} ${offer.name || ""}`);
  const isDarkTheme = style.id === "obsidian_pro" || style.id === "new_release" || style.id === "minimal_slate";

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);
  drawSquircleIcon(ctx, image, offer.name, {
    x: -iconSize / 2,
    y: -iconSize / 2,
    size: iconSize,
    radius: Math.round(iconSize * 0.24),
    tileBg: isYoutube && isDarkTheme ? "#151519" : "#ffffff",
    borderColor: isYoutube && isDarkTheme ? "rgba(255, 255, 255, 0.2)" : "rgba(15, 23, 42, 0.08)",
    ink: style.ink,
    shadow: true,
    padRatio: isYoutube ? 0.17 : 0.06,
  });
  ctx.restore();

  if (offer.discount > 0 || offer.outOfStock) {
    const label = offer.outOfStock ? "STOK HABIS" : `HEMAT ${offer.discount}%`;
    drawChip(ctx, label, x + w - 22, y + 22, {
      bg: offer.outOfStock ? "#475467" : "#d92d20",
      textColor: "#ffffff",
      fontSize: 16,
      weight: 800,
      radius: 999,
      padX: 16,
      height: 36,
      align: "right",
    });
  }
}

export function drawProductPoster(canvas, {
  offer,
  styleId,
  format = "square",
  variation = 0,
  headline = "",
  badge = "",
  image,
  qr,
  phone,
  footerMode = "standard",
}) {
  const { width, height } = MEDIA_FORMATS[format] || MEDIA_FORMATS.square;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const s = MEDIA_STYLES.find(style => style.id === styleId) || MEDIA_STYLES[0];
  const story = format === "story";
  const banner = format === "banner";
  const mode = variation % 3;

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // 1. Ambient Canvas Background + Dot Grid
  fillBackdrop(ctx, width, height, s.bg, s.bg2);
  drawGlowOrb(ctx, width * 0.86, height * 0.16, width * 0.52, s.accent, 0.16);
  drawGlowOrb(ctx, width * 0.12, height * 0.72, width * 0.45, s.secondary, 0.14);
  dotTexture(ctx, width, height, s.ink, 52, 0.055);

  const margin = story ? 64 : 56;

  // 2. Top Brand & Tag Pill Bar
  const topY = story ? 112 : 48;
  drawChip(ctx, "imzaqi.store", margin, topY, {
    bg: s.cardBg,
    borderColor: s.cardBorder,
    textColor: s.ink,
    fontSize: 18,
    weight: 800,
    radius: 999,
    padX: 18,
    height: 40,
  });

  drawChip(ctx, (badge || s.tag).toUpperCase(), width - margin, topY, {
    bg: s.accent,
    textColor: s.badgeText || "#ffffff",
    fontSize: 14,
    weight: 800,
    radius: 999,
    padX: 16,
    height: 38,
    align: "right",
  });

  // 3. Layout Coordinates by Aspect Ratio
  const detailsText =
    [offer.variant, offer.duration]
      .filter(Boolean)
      .filter((value, i, arr) => arr.indexOf(value) === i)
      .join(" · ") || "Pilih paket di website";

  const hasDiscount = Boolean(offer.original && offer.original > offer.price);
  const flashPriceColor =
    s.id === "obsidian_pro" || s.id === "new_release" || s.id === "minimal_slate"
      ? "#ff6b60"
      : "#d92d20";
  const priceText = offer.price ? money(offer.price) : "Tanya admin";

  if (story) {
    // ── STORY (1080 × 1920) ──
    const copyWidth = width - margin * 2;
    const headY = 248;
    let showcaseY = 446;
    if (!headline) {
      const headSize = fit(ctx, s.headline.reduce((a, b) => (a.length > b.length ? a : b)), copyWidth, 92, 800, 48);
      s.headline.forEach((line, i) => {
        ctx.fillStyle = i === 1 ? s.accent : s.ink;
        ctx.fillText(line, margin, headY + i * headSize * 1.02);
      });
      const subY = Math.round(headY + (s.headline.length - 1) * headSize * 1.02 + 54);
      ctx.fillStyle = s.muted || s.ink;
      font(ctx, 24, 600);
      ctx.fillText("Aktivasi cepat · Garansi layanan penuh", margin, subY);
      showcaseY = Math.max(446, subY + 48);
    } else {
      ctx.fillStyle = s.ink;
      const afterCustom = textBlock(ctx, headline, margin, headY, copyWidth, 88, 2, 800);
      showcaseY = Math.max(446, afterCustom + 30);
    }

    // Centerpiece Showcase Bento Card
    const showcaseH = Math.max(480, 996 - showcaseY);
    drawShowcaseCard(ctx, s, {
      x: margin,
      y: showcaseY,
      w: copyWidth,
      h: showcaseH,
      image,
      offer,
      variation,
      radius: 42,
    });

    // Guarantee trust pill inside bottom-left of showcase
    if (offer.guarantee) {
      drawChip(ctx, `Garansi: ${offer.guarantee}`, margin + 24, showcaseY + showcaseH - 58, {
        bg: s.bg,
        borderColor: s.cardBorder,
        textColor: s.ink,
        fontSize: 15,
        weight: 700,
        radius: 999,
        padX: 16,
        height: 36,
      });
    }

    // Product & Price Bento Panel
    const cardY = 1036;
    const cardH = 472;
    drawRoundedBox(ctx, margin, cardY, copyWidth, cardH, 38, {
      fill: s.cardBg,
      stroke: s.cardBorder,
      lineWidth: 2,
      shadowColor: "rgba(0, 0, 0, 0.12)",
      shadowBlur: 32,
      shadowOffsetY: 14,
    });

    ctx.fillStyle = s.ink;
    const afterName = textBlock(ctx, offer.name, margin + 40, cardY + 84, copyWidth - 80, 56, 2, 800, 32);

    ctx.fillStyle = s.muted || s.ink;
    font(ctx, 24, 600);
    textBlock(ctx, detailsText, margin + 40, Math.max(afterName + 8, cardY + 188), copyWidth - 80, 24, 1, 600, 18);

    // Subtle divider
    ctx.save();
    ctx.strokeStyle = s.cardBorder;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(margin + 40, cardY + 236);
    ctx.lineTo(margin + copyWidth - 40, cardY + 236);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = s.muted || s.ink;
    font(ctx, 18, 700);
    ctx.fillText(offer.outOfStock ? "HARGA PAKET · KONFIRMASI STOK" : "HARGA PAKET PILIHAN", margin + 40, cardY + 286);

    fit(ctx, priceText, copyWidth - 80, 114, 800, 52);
    ctx.fillStyle = hasDiscount ? flashPriceColor : s.ink;
    const priceBaselineY = cardY + 394;
    ctx.fillText(priceText, margin + 38, priceBaselineY);

    if (hasDiscount) {
      const original = money(offer.original);
      font(ctx, 26, 600);
      const oy = cardY + 442;
      ctx.save();
      ctx.fillStyle = s.muted || s.ink;
      ctx.fillText(original, margin + 40, oy);
      const ow = ctx.measureText(original).width;
      ctx.strokeStyle = s.muted || s.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(margin + 40, oy - 8);
      ctx.lineTo(margin + 40 + ow, oy - 8);
      ctx.stroke();
      ctx.restore();
    }

    drawFooterDock(ctx, {
      x: margin,
      y: height - 270,
      w: copyWidth,
      h: 210,
      bg: s.footerBg,
      ink: s.footerInk,
      accent: s.secondary,
      qr,
      phone,
      footerMode,
    });
  } else if (banner) {
    // ── BANNER (1920 × 1080) ──
    const flipped = mode === 1;
    const showcaseW = 660;
    const showcaseX = flipped ? margin : width - margin - showcaseW;
    const leftX = flipped ? margin + showcaseW + 40 : margin;
    const leftW = width - margin * 2 - showcaseW - 40;

    // Headline top-left/right
    const headY = 188;
    if (!headline) {
      const headSize = fit(ctx, s.headline.reduce((a, b) => (a.length > b.length ? a : b)), leftW, 92, 800, 44);
      s.headline.forEach((line, i) => {
        ctx.fillStyle = i === 1 ? s.accent : s.ink;
        ctx.fillText(line, leftX, headY + i * headSize * 1.02);
      });
    } else {
      ctx.fillStyle = s.ink;
      textBlock(ctx, headline, leftX, headY, leftW, 84, 2, 800);
    }

    // Showcase Card
    drawShowcaseCard(ctx, s, {
      x: showcaseX,
      y: 112,
      w: showcaseW,
      h: 690,
      image,
      offer,
      variation,
      radius: 38,
    });

    // Product & Price Bento Panel
    const cardY = 408;
    const cardH = 394;
    drawRoundedBox(ctx, leftX, cardY, leftW, cardH, 32, {
      fill: s.cardBg,
      stroke: s.cardBorder,
      lineWidth: 2,
      shadowColor: "rgba(0, 0, 0, 0.12)",
      shadowBlur: 30,
      shadowOffsetY: 12,
    });

    ctx.fillStyle = s.ink;
    const afterName = textBlock(ctx, offer.name, leftX + 36, cardY + 72, leftW - 72, 48, 2, 800, 28);
    ctx.fillStyle = s.muted || s.ink;
    font(ctx, 21, 600);
    textBlock(ctx, detailsText, leftX + 36, Math.max(afterName + 6, cardY + 150), leftW - 72, 21, 1, 600, 16);

    if (offer.guarantee) {
      drawChip(ctx, `Garansi: ${offer.guarantee}`, leftX + leftW - 32, cardY + 34, {
        bg: s.bg,
        borderColor: s.cardBorder,
        textColor: s.ink,
        fontSize: 14,
        weight: 700,
        radius: 999,
        padX: 14,
        height: 32,
        align: "right",
      });
    }

    ctx.save();
    ctx.strokeStyle = s.cardBorder;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(leftX + 36, cardY + 194);
    ctx.lineTo(leftX + leftW - 36, cardY + 194);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = s.muted || s.ink;
    font(ctx, 16, 700);
    ctx.fillText(offer.outOfStock ? "HARGA PAKET · KONFIRMASI STOK" : "HARGA PAKET PILIHAN", leftX + 36, cardY + 236);

    fit(ctx, priceText, leftW - 72, 92, 800, 44);
    ctx.fillStyle = hasDiscount ? flashPriceColor : s.ink;
    const priceY = cardY + 328;
    ctx.fillText(priceText, leftX + 34, priceY);

    if (hasDiscount) {
      const original = money(offer.original);
      font(ctx, 22, 600);
      const ox = leftX + 36;
      const oy = cardY + 368;
      ctx.save();
      ctx.fillStyle = s.muted || s.ink;
      ctx.fillText(original, ox, oy);
      const ow = ctx.measureText(original).width;
      ctx.strokeStyle = s.muted || s.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ox, oy - 7);
      ctx.lineTo(ox + ow, oy - 7);
      ctx.stroke();
      ctx.restore();
    }

    drawFooterDock(ctx, {
      x: margin,
      y: 840,
      w: width - margin * 2,
      h: 184,
      bg: s.footerBg,
      ink: s.footerInk,
      accent: s.secondary,
      qr,
      phone,
      footerMode,
    });
  } else {
    // ── SQUARE (1080 × 1080) ──
    const flipped = mode === 1;
    const showcaseW = 376;
    const showcaseH = 392;
    const showcaseX = flipped ? margin : width - margin - showcaseW;
    const copyX = flipped ? margin + showcaseW + 34 : margin;
    const copyWidth = width - margin * 2 - showcaseW - 34;

    const headY = 198;
    let chipY = 360;
    if (!headline) {
      const headSize = fit(ctx, s.headline.reduce((a, b) => (a.length > b.length ? a : b)), copyWidth, 74, 800, 38);
      s.headline.forEach((line, i) => {
        ctx.fillStyle = i === 1 ? s.accent : s.ink;
        ctx.fillText(line, copyX, headY + i * headSize * 1.04);
      });
      const subY = headY + s.headline.length * headSize * 1.04 + 12;
      ctx.fillStyle = s.muted || s.ink;
      font(ctx, 20, 600);
      ctx.fillText("Aktivasi cepat · Layanan resmi", copyX, subY);
      chipY = subY + 28;
    } else {
      ctx.fillStyle = s.ink;
      const afterCustom = textBlock(ctx, headline, copyX, headY, copyWidth, 70, 2, 800);
      chipY = Math.min(416, Math.max(338, afterCustom + 14));
    }

    // Subtle trust chip under headline
    drawChip(
      ctx,
      offer.guarantee ? `Garansi: ${offer.guarantee}` : "Proses cepat · QRIS otomatis",
      copyX,
      chipY,
      {
        bg: s.cardBg,
        borderColor: s.cardBorder,
        textColor: s.ink,
        fontSize: 15,
        weight: 700,
        radius: 999,
        padX: 16,
        height: 36,
      }
    );

    // Showcase Bento Card
    drawShowcaseCard(ctx, s, {
      x: showcaseX,
      y: 112,
      w: showcaseW,
      h: showcaseH,
      image,
      offer,
      variation,
      radius: 34,
    });

    // Wide Product & Price Bento Panel across middle-lower span
    const panelY = 532;
    const panelH = 294;
    const panelW = width - margin * 2;
    drawRoundedBox(ctx, margin, panelY, panelW, panelH, 30, {
      fill: s.cardBg,
      stroke: s.cardBorder,
      lineWidth: 2,
      shadowColor: "rgba(0, 0, 0, 0.12)",
      shadowBlur: 32,
      shadowOffsetY: 12,
    });

    ctx.fillStyle = s.ink;
    const afterName = textBlock(ctx, offer.name, margin + 36, panelY + 66, panelW - 72, 44, 1, 800, 26);

    ctx.fillStyle = s.muted || s.ink;
    font(ctx, 20, 600);
    textBlock(ctx, detailsText, margin + 36, Math.max(afterName - 2, panelY + 104), panelW - 72, 20, 1, 600, 16);

    ctx.save();
    ctx.strokeStyle = s.cardBorder;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(margin + 36, panelY + 128);
    ctx.lineTo(margin + panelW - 36, panelY + 128);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = s.muted || s.ink;
    font(ctx, 16, 700);
    ctx.fillText(offer.outOfStock ? "HARGA PAKET · KONFIRMASI STOK" : "HARGA PAKET PILIHAN", margin + 36, panelY + 168);

    const maxPriceWidth = hasDiscount ? panelW * 0.62 : panelW - 72;
    fit(ctx, priceText, maxPriceWidth, 88, 800, 42);
    ctx.fillStyle = hasDiscount ? flashPriceColor : s.ink;
    const priceY = panelY + 252;
    ctx.fillText(priceText, margin + 34, priceY);

    if (hasDiscount) {
      const priceW = ctx.measureText(priceText).width;
      const original = money(offer.original);
      font(ctx, 24, 600);
      const ox = margin + 34 + priceW + 18;
      if (ox + ctx.measureText(original).width < margin + panelW - 36) {
        ctx.save();
        ctx.fillStyle = s.muted || s.ink;
        ctx.fillText(original, ox, priceY - 4);
        const ow = ctx.measureText(original).width;
        ctx.strokeStyle = s.muted || s.ink;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ox, priceY - 12);
        ctx.lineTo(ox + ow, priceY - 12);
        ctx.stroke();
        ctx.restore();
      }
    }

    drawFooterDock(ctx, {
      x: margin,
      y: 858,
      w: panelW,
      h: 166,
      bg: s.footerBg,
      ink: s.footerInk,
      accent: s.secondary,
      qr,
      phone,
      footerMode,
    });
  }

  return { width, height };
}

export function drawCatalogPoster(canvas, {
  products,
  discounts,
  theme = "emerald",
  page = 1,
  pageCount = 1,
  total,
  images = [],
  qr,
  phone,
  catalogScope = "products",
  footerMode = "standard",
}) {
  const width = 1200;
  const height = 1600;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  const isDark = theme === "dark";
  const bgTop = isDark ? "#0b120f" : "#f3faf6";
  const bgBottom = isDark ? "#12201b" : "#e3f2ea";
  const ink = isDark ? "#eef4e7" : "#143f32";
  const muted = isDark ? "#9ec0b1" : "#426a5b";
  const accent = isDark ? "#34d399" : "#059669";
  const cardBg = isDark ? "#16241f" : "#ffffff";
  const cardBorder = isDark ? "rgba(52, 211, 153, 0.2)" : "rgba(0, 130, 80, 0.14)";
  const footerBg = isDark ? "#192d25" : "#0e2f23";
  const footerInk = "#f4fbf7";

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // 1. Background Mesh
  fillBackdrop(ctx, width, height, bgTop, bgBottom);
  drawGlowOrb(ctx, width * 0.85, 160, 440, accent, isDark ? 0.14 : 0.12);
  drawGlowOrb(ctx, 180, 1280, 400, accent, 0.08);
  dotTexture(ctx, width, height, ink, 48, 0.05);

  const margin = 56;
  const isVariantScope = catalogScope === "variants";

  // 2. Top Header Pills
  drawChip(ctx, "imzaqi.store", margin, 46, {
    bg: cardBg,
    borderColor: cardBorder,
    textColor: ink,
    fontSize: 18,
    weight: 800,
    radius: 999,
    padX: 18,
    height: 38,
  });

  drawChip(ctx, `${total} ${isVariantScope ? "PAKET" : "PRODUK"} · HAL ${page} / ${pageCount}`, width - margin, 46, {
    bg: isDark ? "rgba(52, 211, 153, 0.16)" : "rgba(0, 158, 96, 0.12)",
    borderColor: cardBorder,
    textColor: accent,
    fontSize: 15,
    weight: 800,
    radius: 999,
    padX: 16,
    height: 36,
    align: "right",
  });

  // 3. Editorial Title + Trust Stamp Bento Box
  font(ctx, 84, 800);
  ctx.fillStyle = ink;
  ctx.fillText("PRICELIST", margin, 182);
  ctx.fillStyle = accent;
  ctx.fillText("RESMI.", margin, 266);

  drawRoundedBox(ctx, width - margin - 294, 120, 294, 136, 26, {
    fill: cardBg,
    stroke: cardBorder,
    lineWidth: 2,
    shadowColor: isDark ? "rgba(0,0,0,0.35)" : "rgba(20, 63, 50, 0.08)",
    shadowBlur: 24,
    shadowOffsetY: 10,
  });
  drawChip(ctx, "TERVERIFIKASI", width - margin - 268, 142, {
    bg: accent,
    textColor: isDark ? "#05261a" : "#ffffff",
    fontSize: 12,
    weight: 800,
    radius: 999,
    padX: 12,
    height: 24,
  });
  ctx.fillStyle = ink;
  font(ctx, 21, 800);
  ctx.fillText("Terpercaya", width - margin - 268, 198);
  ctx.fillStyle = muted;
  font(ctx, 16, 600);
  ctx.fillText("Bergaransi penuh & cepat", width - margin - 268, 228);

  ctx.fillStyle = muted;
  font(ctx, 21, 600);
  ctx.fillText(
    isVariantScope
      ? "Daftar paket & varian siap aktif untuk kebutuhanmu."
      : "Aplikasi premium & layanan pilihan untuk kebutuhanmu.",
    margin,
    316
  );

  // 4. 2-Column Bento Pricelist Cards (max 10 items per page)
  const columnW = 530;
  const colGap = 28;
  const rowH = 178;
  const rowGap = 18;
  const startY = 354;

  products.forEach((item, i) => {
    const x = margin + (i % 2) * (columnW + colGap);
    const y = startY + Math.floor(i / 2) * (rowH + rowGap);

    drawRoundedBox(ctx, x, y, columnW, rowH, 22, {
      fill: cardBg,
      stroke: cardBorder,
      lineWidth: 1.5,
      shadowColor: isDark ? "rgba(0, 0, 0, 0.25)" : "rgba(20, 63, 50, 0.06)",
      shadowBlur: 18,
      shadowOffsetY: 6,
    });

    const targetProduct = item.product || item;
    const targetVariant = item.variant || chooseVariant(targetProduct, "", discounts);
    const offer = item.offer || posterOffer(targetProduct, targetVariant, discounts);

    const isYoutube = /youtube/i.test(`${offer.slug || ""} ${offer.name || ""} ${targetProduct?.slug || ""}`);
    drawSquircleIcon(ctx, images[i], offer.name, {
      x: x + 18,
      y: y + 24,
      size: 86,
      radius: 20,
      tileBg: isYoutube && isDark ? "#151519" : isDark ? "#ffffff" : "#f7fbf9",
      borderColor: isYoutube && isDark ? "rgba(255, 255, 255, 0.2)" : isDark ? "rgba(255,255,255,0.22)" : "rgba(0, 130, 80, 0.12)",
      ink,
      shadow: false,
      padRatio: isYoutube ? 0.17 : 0.06,
    });

    const textX = x + 122;
    const availW = columnW - 140;

    ctx.fillStyle = ink;
    textBlock(ctx, offer.name, textX, y + 48, availW, 25, 2, 800, 19);

    const isVariantItem = isVariantScope || Boolean(item.variant);
    const durationText = offer.duration ? String(offer.duration).trim() : "";
    const variantName = isVariantItem ? String(offer.variant || "").trim() : "";
    const isOut = Boolean(offer.outOfStock);

    const chipBg = isOut
      ? (isDark ? "rgba(233, 61, 54, 0.18)" : "rgba(217, 45, 32, 0.1)")
      : (isDark ? "rgba(52, 211, 153, 0.14)" : "rgba(20, 63, 50, 0.08)");
    const chipBorder = isOut
      ? (isDark ? "rgba(233, 61, 54, 0.36)" : "rgba(217, 45, 32, 0.22)")
      : (isDark ? "rgba(52, 211, 153, 0.32)" : "rgba(20, 63, 50, 0.16)");
    const chipColor = isOut ? (isDark ? "#ff8577" : "#b42318") : isDark ? "#34d399" : "#143f32";

    const chipLabel = isOut ? "Stok habis" : durationText;
    let curX = textX;

    if (isVariantItem && variantName && variantName.toLowerCase() !== offer.name.toLowerCase()) {
      let chipW = 0;
      if (chipLabel) {
        font(ctx, 13, 700);
        chipW = ctx.measureText(chipLabel).width + 24 + 8;
      }
      const maxTextW = Math.max(80, availW - chipW);
      ctx.fillStyle = muted;
      font(ctx, 15, 600);
      let displayVariant = variantName;
      while (displayVariant && ctx.measureText(displayVariant).width > maxTextW && displayVariant.length > 3) {
        displayVariant = displayVariant.slice(0, -1);
      }
      if (displayVariant !== variantName) displayVariant = `${displayVariant.trim()}…`;
      ctx.fillText(displayVariant, curX, y + 106);
      curX += ctx.measureText(displayVariant).width + 8;

      if (chipLabel) {
        drawChip(ctx, chipLabel, curX, y + 89, {
          bg: chipBg,
          borderColor: chipBorder,
          textColor: chipColor,
          fontSize: 12.5,
          weight: 700,
          radius: 7,
          padX: 10,
          height: 24,
        });
      }
    } else if (chipLabel) {
      drawChip(ctx, chipLabel, curX, y + 89, {
        bg: chipBg,
        borderColor: chipBorder,
        textColor: chipColor,
        fontSize: 12.5,
        weight: 700,
        radius: 7,
        padX: 10,
        height: 24,
      });
    } else {
      ctx.fillStyle = muted;
      font(ctx, 15, 600);
      ctx.fillText("Lihat pilihan paket", curX, y + 106);
    }

    const hasDiscount = Boolean(offer.original && offer.original > offer.price);
    const flashPriceColor = isDark ? "#ff6459" : "#d92d20";
    const priceText = isVariantItem
      ? offer.price
        ? money(offer.price)
        : "Tanya admin"
      : offer.price
        ? `Mulai ${money(offer.price)}`
        : "Tanya admin";

    const maxPriceW = hasDiscount ? availW * 0.58 : availW;
    fit(ctx, priceText, maxPriceW, 29, 800, 19);
    const priceWidth = ctx.measureText(priceText).width;

    ctx.fillStyle = hasDiscount ? flashPriceColor : ink;
    ctx.fillText(priceText, textX, y + 150);

    if (hasDiscount) {
      const originalText = isVariantItem ? money(offer.original) : `Mulai ${money(offer.original)}`;
      const origX = textX + priceWidth + 12;
      const availOrigW = x + columnW - 18 - origX;
      if (availOrigW > 45) {
        fit(ctx, originalText, availOrigW, 17, 600, 12);
        const origW = ctx.measureText(originalText).width;
        ctx.save();
        ctx.fillStyle = muted;
        ctx.globalAlpha = 0.72;
        ctx.fillText(originalText, origX, y + 150);
        ctx.strokeStyle = muted;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(origX, y + 144);
        ctx.lineTo(origX + origW, y + 144);
        ctx.stroke();
        ctx.restore();
      }
    }
  });

  // 5. Disclaimer & Bottom Rounded Footer Dock
  ctx.fillStyle = muted;
  font(ctx, 16, 600);
  ctx.fillText("Harga & stok dapat berubah. Scan QR untuk informasi terbaru.", margin, 1378);

  drawFooterDock(ctx, {
    x: margin,
    y: 1406,
    w: width - margin * 2,
    h: 152,
    bg: footerBg,
    ink: footerInk,
    accent: isDark ? "#34d399" : "#34d399",
    qr,
    phone,
    catalog: true,
    footerMode,
  });

  return { width, height };
}
