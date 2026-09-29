import { MEDIA_FORMATS, MEDIA_STYLES, chooseVariant, posterOffer } from "./marketingMediaModel.js";

const FONT = '"Outfit", "Plus Jakarta Sans", sans-serif';
const money = value => `Rp${new Intl.NumberFormat("id-ID").format(value)}`;

function font(ctx, size, weight = 700) { ctx.font = `${weight} ${size}px ${FONT}`; }
function fit(ctx, text, width, size, weight = 700, min = 18) {
  font(ctx, size, weight);
  while (ctx.measureText(text).width > width && size > min) font(ctx, --size, weight);
  return size;
}

export function wrapText(ctx, text, width, maxLines = 2) {
  const words = String(text).trim().split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) { lines.push(line); line = word; }
    else line = next;
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

function textBlock(ctx, text, x, y, width, size, maxLines = 2, weight = 700) {
  font(ctx, size, weight);
  let lines = wrapText(ctx, text, width, 99);
  while (lines.length > maxLines && size > 26) {
    font(ctx, --size, weight);
    lines = wrapText(ctx, text, width, 99);
  }
  lines = wrapText(ctx, text, width, maxLines);
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * size * 1.13));
  return y + lines.length * size * 1.13;
}

function star(ctx, x, y, radius, color, rotation = 0, points = 14) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rotation);
  ctx.fillStyle = color; ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? radius * .83 : radius;
    const angle = i * Math.PI / points;
    const px = Math.cos(angle) * r, py = Math.sin(angle) * r;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath(); ctx.fill(); ctx.restore();
}

function texture(ctx, w, h) {
  ctx.save();
  let seed = 37;
  for (let i = 0; i < w * h / 180; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const x = seed % w;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    ctx.fillStyle = i % 2 ? "rgba(0,0,0,.045)" : "rgba(255,255,255,.1)";
    ctx.fillRect(x, seed % h, 1.5, 1.5);
  }
  ctx.restore();
}

function imageContain(ctx, image, x, y, size) {
  const scale = Math.min(size / image.width, size / image.height);
  const w = image.width * scale, h = image.height * scale;
  ctx.drawImage(image, x + (size - w) / 2, y + (size - h) / 2, w, h);
}

function art(ctx, style, image, name, cx, cy, size, variation) {
  const tilt = ((variation % 5) - 2) * .055;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(tilt);
  if (style.id === "best_seller") {
    ctx.fillStyle = style.accent;
    ctx.beginPath(); ctx.ellipse(0, 0, size * .8, size * .95, -.28, 0, Math.PI * 2); ctx.fill();
    star(ctx, -size * .54, size * .65, size * .18, style.secondary, .2, 9);
  } else if (style.id === "flash_sale") {
    star(ctx, 0, 0, size * .94, style.accent, -.08, 18);
    star(ctx, size * .5, -size * .62, size * .18, style.ink, .2, 8);
  } else if (style.id === "new_release") {
    ctx.strokeStyle = style.accent; ctx.lineWidth = size * .095;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.ellipse(0, 0, size * (.69 + i * .19), size * (.44 + i * .15), -.55, 0, Math.PI * 2); ctx.stroke();
    }
    star(ctx, size * .65, -size * .68, size * .12, style.secondary, 0, 4);
  } else {
    ctx.fillStyle = style.accent; ctx.rotate(-.13); ctx.fillRect(-size * .7, -size * .72, size * 1.4, size * 1.44);
    ctx.rotate(.26); ctx.fillStyle = style.secondary; ctx.fillRect(-size * .57, -size * .67, size * 1.14, size * 1.34);
  }
  ctx.shadowColor = "rgba(0,0,0,.2)"; ctx.shadowBlur = 38; ctx.shadowOffsetY = 22;
  if (image) imageContain(ctx, image, -size / 2, -size / 2, size);
  else {
    ctx.fillStyle = style.id === "new_release" ? "#fff" : style.ink;
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; font(ctx, size * .6);
    ctx.fillText(name.slice(0, 1).toUpperCase(), 0, 0);
  }
  ctx.restore();
}

function footer(ctx, { width, height, story, ink, bg, qr, phone, catalog = false }) {
  const y = story ? height - 280 : height - 162;
  ctx.fillStyle = ink; ctx.fillRect(0, y, width, height - y);
  ctx.fillStyle = bg; ctx.textAlign = "left";
  font(ctx, 19, 600); ctx.fillText(catalog ? "TEMUKAN PAKETMU DI" : "PILIH PAKET. LANJUT CHECKOUT.", 64, y + 42);
  font(ctx, 35); ctx.fillText("imzaqi.store", 64, y + 91);
  font(ctx, 19, 600);
  ctx.fillText(phone ? `Tanya admin · +${phone}` : "Scan QR untuk lihat produk & stok terbaru", 64, y + 124);
  if (qr) {
    const size = 120, x = width - size - 64;
    ctx.fillStyle = "#fff"; ctx.fillRect(x, y + 20, size, size);
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qr, x, y + 20, size, size); ctx.restore();
  }
}

export function drawProductPoster(canvas, { offer, styleId, format = "square", variation = 0, headline = "", badge = "", image, qr, phone }) {
  const { width, height } = MEDIA_FORMATS[format] || MEDIA_FORMATS.square;
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  const s = MEDIA_STYLES.find(style => style.id === styleId) || MEDIA_STYLES[0];
  const story = format === "story", banner = format === "banner";
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  ctx.fillStyle = s.bg; ctx.fillRect(0, 0, width, height);
  // Deliberately oversized ink fields and cut-paper shapes run off the canvas.
  if (s.id === "best_seller") {
    ctx.fillStyle = "#dce8cc";
    ctx.beginPath(); ctx.moveTo(width * .72, 0); ctx.lineTo(width, 0); ctx.lineTo(width, height); ctx.lineTo(width * .5, height); ctx.closePath(); ctx.fill();
  } else if (s.id === "flash_sale") {
    ctx.save(); ctx.translate(width * .86, height * .44); ctx.rotate(-.2);
    ctx.fillStyle = s.secondary; ctx.fillRect(-width * .12, -height, width, height * 2); ctx.restore();
  } else if (s.id === "new_release") {
    ctx.fillStyle = "#151b86"; ctx.beginPath(); ctx.arc(width * .85, height * .6, width * .6, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = "#d2c0f1"; ctx.beginPath(); ctx.ellipse(width * .94, height * .4, width * .49, height * .48, .2, 0, Math.PI * 2); ctx.fill();
  }
  texture(ctx, width, height);
  ctx.fillStyle = s.ink; font(ctx, 27); ctx.fillText("imzaqi.store", 64, story ? 172 : 83);
  ctx.textAlign = "right"; fit(ctx, badge || s.tag, width * .43, 18, 600);
  ctx.fillText(badge || s.tag, width - 64, story ? 172 : 83); ctx.textAlign = "left";

  const copyWidth = banner ? width * .55 : story ? width - 128 : width * .61;
  const headY = story ? 284 : 186;
  ctx.fillStyle = s.ink;
  const titleLines = headline ? null : s.headline;
  if (titleLines) {
    const headSize = fit(ctx, titleLines.reduce((a, b) => a.length > b.length ? a : b), copyWidth, story ? 130 : banner ? 128 : 104);
    titleLines.forEach((line, i) => ctx.fillText(line, 64, headY + i * headSize * .98));
  } else textBlock(ctx, headline, 64, headY, copyWidth, story ? 120 : 100, 2);

  const cx = banner ? width * .78 : story ? width * .61 : width * .81;
  const cy = story ? 740 : banner ? 480 : 420;
  const iconSize = story ? 300 : banner ? 345 : 235;
  art(ctx, s, image, offer.name, cx, cy, iconSize, variation);
  // Small contrast sticker stays outside the product logo.
  if (offer.discount || offer.outOfStock) {
    const x = Math.min(width - 90, cx + iconSize * .35), y = cy + iconSize * .8;
    star(ctx, x, y, 72, s.secondary, .1, 16);
    ctx.fillStyle = s.id === "flash_sale" ? s.ink : "#1c2520"; ctx.textAlign = "center";
    font(ctx, offer.outOfStock ? 18 : 32);
    ctx.fillText(offer.outOfStock ? "HABIS" : `−${offer.discount}%`, x, y + 10); ctx.textAlign = "left";
  }
  ctx.fillStyle = s.ink;
  const productY = story ? 1100 : 545;
  const productWidth = banner ? width * .54 : story ? width - 128 : width * .63;
  const afterName = textBlock(ctx, offer.name, 64, productY, productWidth, story ? 76 : 58, 2);
  font(ctx, 23, 600);
  const details = [offer.variant, offer.duration].filter(Boolean).filter((value, i, arr) => arr.indexOf(value) === i).join(" · ");
  textBlock(ctx, details || "Pilih paket di website", 64, Math.max(afterName + 6, story ? 1270 : 666), productWidth, 23, 1, 600);

  const priceY = story ? 1470 : 802;
  font(ctx, 18, 600); ctx.fillText(offer.outOfStock ? "HARGA PAKET · KONFIRMASI STOK" : "HARGA PAKET PILIHAN", 64, priceY - (story ? 140 : 93));
  const priceText = offer.price ? money(offer.price) : "Tanya admin";
  fit(ctx, priceText, banner ? width * .56 : width - 128, story ? 132 : 110);
  ctx.fillText(priceText, 60, priceY);
  if (offer.original) {
    font(ctx, 24, 600);
    const original = money(offer.original), x = 64, y = priceY + 62;
    ctx.globalAlpha = .65; ctx.fillText(original, x, y);
    ctx.strokeStyle = s.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x + ctx.measureText(original).width, y - 8); ctx.stroke(); ctx.globalAlpha = 1;
  }
  font(ctx, 20, 600);
  const note = offer.guarantee ? (/garansi/i.test(offer.guarantee) ? offer.guarantee : `Garansi: ${offer.guarantee}`) : "Detail paket & ketersediaan ada di website";
  textBlock(ctx, note, 64, story ? 1580 : 896, width - 128, 20, 1, 600);
  footer(ctx, { width, height, story, ink: s.ink, bg: s.bg, qr, phone });
  return { width, height };
}

export function drawCatalogPoster(canvas, { products, discounts, theme = "emerald", page = 1, pageCount = 1, total, images = [], qr, phone }) {
  const width = 1200, height = 1600;
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  const bg = theme === "dark" ? "#171c21" : "#f4f0e5";
  const ink = theme === "dark" ? "#eef4e7" : "#143f32";
  const accent = theme === "dark" ? "#b8df75" : "#c6e983";
  ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height); texture(ctx, width, height);
  ctx.fillStyle = ink; ctx.textAlign = "left"; font(ctx, 27); ctx.fillText("imzaqi.store", 64, 82);
  ctx.textAlign = "right"; font(ctx, 19, 600); ctx.fillText(`${total} PRODUK · ${page} / ${pageCount}`, width - 64, 82); ctx.textAlign = "left";
  font(ctx, 90); ctx.fillText("KATALOG", 60, 210); ctx.fillText("PILIHANMU.", 60, 298);
  star(ctx, 1000, 220, 126, accent, -.14, 16);
  ctx.fillStyle = "#143f32"; ctx.textAlign = "center"; font(ctx, 25); ctx.fillText("PILIH.", 1000, 213); ctx.fillText("PAKAI.", 1000, 245); ctx.textAlign = "left";
  ctx.fillStyle = ink; font(ctx, 22, 600); ctx.fillText("Aplikasi premium & layanan untuk kebutuhanmu.", 64, 351);
  const columnW = 508, gap = 56, rowH = 190, startY = 412;
  products.forEach((product, i) => {
    const x = 64 + i % 2 * (columnW + gap), y = startY + Math.floor(i / 2) * rowH;
    ctx.strokeStyle = theme === "dark" ? "#41493e" : "#cad0bb"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + columnW, y); ctx.stroke();
    const offer = posterOffer(product, chooseVariant(product, "", discounts), discounts);
    if (images[i]) imageContain(ctx, images[i], x, y + 25, 70);
    else { ctx.fillStyle = ink; font(ctx, 44); ctx.fillText(offer.name.slice(0, 1), x + 15, y + 76); }
    ctx.fillStyle = ink;
    textBlock(ctx, offer.name, x + 91, y + 47, columnW - 91, 29, 2);
    font(ctx, 18, 600); ctx.globalAlpha = .72;
    const hint = offer.outOfStock ? "Stok habis · tanya admin" : offer.duration || "Lihat pilihan paket";
    fit(ctx, hint, columnW - 91, 18, 600); ctx.fillText(hint, x + 91, y + 103); ctx.globalAlpha = 1;
    fit(ctx, offer.price ? `Mulai ${money(offer.price)}` : "Tanya admin", columnW - 91, 31);
    ctx.fillText(offer.price ? `Mulai ${money(offer.price)}` : "Tanya admin", x + 91, y + 150);
  });
  font(ctx, 16, 600); ctx.fillStyle = ink; ctx.fillText("Harga & stok dapat berubah. Scan QR untuk informasi terbaru.", 64, 1390);
  footer(ctx, { width, height, ink, bg, qr, phone, catalog: true });
}
