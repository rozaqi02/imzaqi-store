const ROUTE_HINTS = {
  "/": {
    label: "beranda",
    tags: ["produk", "toko"],
    tip: "Kamu bisa mulai dari katalog atau cari produk lewat search di Hero.",
  },
  "/produk": {
    label: "katalog",
    tags: ["produk"],
    tip: "Di katalog kamu bisa filter, sort, dan bandingin varian sebelum masuk keranjang.",
  },
  "/checkout": {
    label: "checkout",
    tags: ["bayar", "promo"],
    tip: "Pastikan varian & jumlah sudah benar sebelum lanjut bayar.",
  },
  "/bayar": {
    label: "pembayaran",
    tags: ["bayar"],
    tip: "Lengkapi WhatsApp valid dulu supaya QRIS bisa terbuka.",
  },
  "/status": {
    label: "status order",
    tags: ["status"],
    tip: "Masukkan ID order format IMZ-XXXX untuk lacak progres.",
  },
  "/tentang": {
    label: "FAQ",
    tags: ["toko", "bayar"],
    tip: "Halaman FAQ punya jawaban lengkap soal order, bayar, dan garansi.",
  },
  "/testimoni": {
    label: "testimoni",
    tags: ["toko"],
    tip: "Baca pengalaman buyer lain sebelum memilih paket.",
  },
};

const PRODUCT_ALIASES = {
  netflix: ["netflix", "nflx", "netflik"],
  spotify: ["spotify", "spo", "spotfy"],
  canva: ["canva", "canva pro"],
  chatgpt: ["chatgpt", "gpt", "openai", "chat gpt", "chat gpt plus"],
  youtube: ["youtube", "yt", "yutub", "youtube premium"],
  capcut: ["capcut", "cap cut"],
  duolingo: ["duolingo", "duo lingo"],
  viu: ["viu"],
  iqiyi: ["iqiyi", "iqy"],
  disney: ["disney", "disney+", "disneyplus", "disney plus"],
  prime: ["prime", "amazon", "prime video"],
  hbo: ["hbo", "hbo max", "max"],
  scribd: ["scribd"],
  grammarly: ["grammarly"],
};

const FOLLOWUP_MARKERS = [
  "itu", "ini", "tadi", "terus", "lanjut", "lagi", "juga", "sama",
  "yang barusan", "yang tadi", "yg tadi", "yg itu", "yg ini",
  "gimana lagi", "terus gimana", "lalu", "habis itu", "selanjutnya",
  "masih", "kok", "kenapa", "trus",
];

const NEGATION_WORDS = ["tidak", "gak", "ga", "gk", "belum", "jangan", "bukan", "nggak", "enggak", "no"];

const INTENT_PHRASES = {
  order_lookup: [
    "id order", "kode order", "order id", "nomor order", "cek order",
    "lacak order", "tracking order", "imz-", "imz ",
  ],
  warranty: [
    "klaim garansi", "garansi berapa", "masih garansi", "akun mati",
    "akun rusak", "ke logout", "kelogout", "diganti gak", "replace akun",
  ],
  payment: [
    "cara bayar", "gimana bayar", "bayar pake", "scan qris", "qris error",
    "pembayaran gagal", "sudah transfer", "udah bayar", "belum lunas",
  ],
  status: [
    "cek status", "status order", "order saya", "pesanan saya", "dimana order",
    "belum dikirim", "belum datang", "lama banget", "proses berapa lama",
  ],
  promo: [
    "ada promo", "kode diskon", "potongan harga", "voucher aktif", "diskon berapa",
  ],
  refund: [
    "minta refund", "uang balik", "batal order", "cancel order", "balikin uang",
  ],
  product: [
    "rekomendasi", "paling murah", "sharing atau private", "beda varian",
    "stok ada", "masih ready", "berapa harga", "harga termurah",
  ],
  support: [
    "hubungi admin", "chat admin", "nomor wa", "kontak cs", "admin online",
  ],
  comparison: [
    "bedanya", "perbedaan", "mending", "lebih bagus", "sharing vs", "private vs",
  ],
  security: [
    "aman gak", "beneran aman", "trusted", "penipuan", "scam", "legal",
  ],
};

export function getRouteContext(pathname = "/") {
  if (ROUTE_HINTS[pathname]) return ROUTE_HINTS[pathname];

  if (pathname.startsWith("/produk/")) {
    return {
      label: "detail produk",
      tags: ["produk"],
      tip: "Di halaman detail, pilih varian dulu baru tambah ke keranjang.",
    };
  }

  return null;
}

export function extractEntities(text) {
  const raw = String(text || "");
  const lower = raw.toLowerCase();

  const orderCodes = [];
  const orderMatches = raw.match(/\bIMZ[-\s]?[A-Z0-9]{4}\b/gi) || [];
  orderMatches.forEach((code) => orderCodes.push(code.toUpperCase().replace(/\s/g, "-")));

  const shortCodes = raw.match(/\b[A-Z0-9]{4}\b/g) || [];
  shortCodes.forEach((code) => {
    if (!orderCodes.includes(`IMZ-${code}`)) orderCodes.push(`IMZ-${code}`);
  });

  const products = [];
  Object.entries(PRODUCT_ALIASES).forEach(([product, aliases]) => {
    if (aliases.some((alias) => lower.includes(alias))) products.push(product);
  });

  const phones = raw.match(/\b08\d{8,12}\b/g) || [];

  return { orderCodes, products, phones };
}

export function getHistorySignals(history = []) {
  const tags = new Set();
  const topics = [];
  const entities = { orderCodes: [], products: [] };

  history.slice(-8).forEach((turn) => {
    (turn.tags || []).forEach((tag) => tags.add(tag));
    if (turn.q) topics.push(String(turn.q).toLowerCase());
    const ent = extractEntities(turn.q || "");
    ent.orderCodes.forEach((c) => {
      if (!entities.orderCodes.includes(c)) entities.orderCodes.push(c);
    });
    ent.products.forEach((p) => {
      if (!entities.products.includes(p)) entities.products.push(p);
    });
  });

  return {
    tags: Array.from(tags),
    topics,
    entities,
    lastTags: history.length ? history[history.length - 1]?.tags || [] : [],
    lastQuestion: history.length ? history[history.length - 1]?.q || "" : "",
    turnCount: history.length,
  };
}

export function detectNegation(text) {
  const lower = String(text || "").toLowerCase();
  return NEGATION_WORDS.some((w) => new RegExp(`\\b${w}\\b`).test(lower));
}

export function detectQuestionType(text) {
  const lower = String(text || "").toLowerCase();
  if (/^(berapa|brp|bbrp)\b/.test(lower) || lower.includes("berapa harga")) return "how_much";
  if (/^(gimana|gmna|gmn|cara|bagaimana)\b/.test(lower)) return "how";
  if (/^(kapan|kpn)\b/.test(lower)) return "when";
  if (/^(kenapa|kok|mengapa)\b/.test(lower)) return "why";
  if (/^(apa|apakah|bisa)\b/.test(lower)) return "what";
  if (/^(mana|mending|lebih)\b/.test(lower)) return "which";
  return "general";
}

export function isFollowUpQuery(text) {
  const lower = String(text || "").toLowerCase().trim();
  if (lower.split(/\s+/).length <= 3) {
    return FOLLOWUP_MARKERS.some((m) => lower.includes(m));
  }
  return FOLLOWUP_MARKERS.some((m) => lower.startsWith(m) || lower.includes(` ${m}`));
}

/**
 * Expand short follow-up queries using conversation memory.
 */
export function resolveFollowUpQuery(query, history = []) {
  const raw = String(query || "").trim();
  if (!raw || !history.length) return raw;

  const lower = raw.toLowerCase();
  const last = history[history.length - 1];
  const lastQ = String(last?.q || "").trim();
  const lastTags = last?.tags || [];
  const histEnt = getHistorySignals(history).entities;

  const isShort = lower.split(/\s+/).filter(Boolean).length <= 4;
  const isFollowUp = isFollowUpQuery(raw);

  if (!isShort && !isFollowUp) return raw;

  const tagHints = lastTags.join(" ");
  const productHint = histEnt.products[0] || "";
  const orderHint = histEnt.orderCodes[0] || "";

  if (detectNegation(lower) && lastQ) {
    return `${raw} (lanjutan: ${lastQ})`;
  }

  if (lower.includes("itu") || lower.includes("ini") || lower.includes("tadi")) {
    if (orderHint) return `${raw} — konteks order ${orderHint} — topik: ${lastQ}`;
    if (productHint) return `${raw} — konteks produk ${productHint} — topik: ${lastQ}`;
    return `${raw} — lanjutan pertanyaan: ${lastQ}`;
  }

  if (lastQ && (isFollowUp || isShort)) {
    return `${raw} — lanjutan: ${lastQ} — topik: ${tagHints}`;
  }

  return raw;
}

function matchIntentPhrases(text, phraseMap) {
  const lower = String(text || "").toLowerCase();
  for (const [intentId, phrases] of Object.entries(phraseMap)) {
    if (phrases.some((p) => lower.includes(p))) return intentId;
  }
  return null;
}

export function buildAssistantContext({ pathname = "/", history = [], query = "" } = {}) {
  const resolvedQuery = resolveFollowUpQuery(query, history);
  const route = getRouteContext(pathname);
  const entities = extractEntities(resolvedQuery);
  const historySignals = getHistorySignals(history);
  const negation = detectNegation(resolvedQuery);
  const questionType = detectQuestionType(resolvedQuery);
  const isFollowUp = isFollowUpQuery(query);

  if (!entities.orderCodes.length && historySignals.entities.orderCodes.length) {
    entities.orderCodes = [...historySignals.entities.orderCodes];
  }
  if (!entities.products.length && historySignals.entities.products.length && isFollowUp) {
    entities.products = [...historySignals.entities.products];
  }

  return {
    pathname,
    route,
    entities,
    historySignals,
    negation,
    questionType,
    isFollowUp,
    resolvedQuery,
    originalQuery: query,
  };
}

export function detectIntent(query, context = {}) {
  const text = String(context.resolvedQuery || query || "").toLowerCase();
  const tokens = text.split(/\s+/).filter(Boolean);
  const { entities, historySignals, route, negation, questionType, isFollowUp } = context;

  const has = (...words) => words.some((w) => text.includes(w));

  const phraseIntent = matchIntentPhrases(text, INTENT_PHRASES);
  if (phraseIntent) {
    const tagMap = {
      order_lookup: ["status"],
      warranty: ["garansi"],
      payment: ["bayar"],
      status: ["status"],
      promo: ["promo"],
      refund: ["refund", "status"],
      product: ["produk"],
      support: ["toko"],
      comparison: ["produk"],
      security: ["toko"],
    };
    return {
      id: phraseIntent,
      tags: tagMap[phraseIntent] || [],
      weight: 2.6,
      negation,
      questionType,
    };
  }

  if (has("halo", "hai", "hello", "pagi", "siang", "malam", "permisi", "assalamualaikum")) {
    return { id: "greeting", tags: ["toko"], weight: 1.2, negation, questionType };
  }
  if (has("makasih", "terima kasih", "thanks", "thx", "mantap", "oke sip", "mantul", "keren")) {
    return { id: "thanks", tags: ["toko"], weight: 1.2, negation, questionType };
  }
  if (entities.orderCodes?.length || has("imz", "id order", "kode order", "order id")) {
    return { id: "order_lookup", tags: ["status"], weight: 2.8, negation, questionType };
  }
  if (has("garansi", "klaim", "rusak", "ganti", "warranty", "logout", "ke-logout", "mati", "error akun")) {
    return { id: "warranty", tags: ["garansi"], weight: 2.4, negation, questionType };
  }
  if (has("qris", "bayar", "transfer", "pembayaran", "scan", "lunasin", "pending", "sudah bayar", "udah bayar")) {
    return { id: "payment", tags: ["bayar"], weight: 2.4, negation, questionType };
  }
  if (has("status", "progress", "proses", "lacak", "tracking", "cek order", "dimana order", "belum dikirim", "belum datang")) {
    return { id: "status", tags: ["status"], weight: 2.4, negation, questionType };
  }
  if (has("promo", "diskon", "voucher", "kupon", "kode promo", "potongan")) {
    return { id: "promo", tags: ["promo"], weight: 2.2, negation, questionType };
  }
  if (has("refund", "batal", "cancel", "balikin", "uang balik", "komplain", "kecewa")) {
    return { id: "refund", tags: ["refund", "status"], weight: 2.2, negation, questionType };
  }
  if (entities.products?.length || has("produk", "varian", "paket", "sharing", "private", "stok", "harga", "murah")) {
    return { id: "product", tags: ["produk"], weight: 2.2, negation, questionType };
  }
  if (has("admin", "wa", "whatsapp", "kontak", "hubungi", "cs", "customer service")) {
    return { id: "support", tags: ["toko"], weight: 2.0, negation, questionType };
  }
  if (has("berapa lama", "kapan", "estimasi", "lama proses", "berapa jam", "berapa menit")) {
    return { id: "timing", tags: ["status"], weight: 1.8, negation, questionType };
  }
  if (has("beda", "bedanya", "perbedaan", "mending", "lebih bagus", "vs", "versus")) {
    return { id: "comparison", tags: ["produk"], weight: 1.8, negation, questionType };
  }
  if (has("aman", "trusted", "penipuan", "scam", "real", "asli")) {
    return { id: "security", tags: ["toko"], weight: 1.8, negation, questionType };
  }

  if (isFollowUp && historySignals.lastTags?.length) {
    return { id: "followup", tags: historySignals.lastTags, weight: 1.6, negation, questionType };
  }

  if (route?.tags?.length) {
    return { id: `route-${route.label}`, tags: route.tags, weight: 0.9, negation, questionType };
  }

  if (historySignals.lastTags?.length) {
    return { id: "context-carry", tags: historySignals.lastTags, weight: 0.8, negation, questionType };
  }

  if (tokens.length <= 2) {
    return { id: "short", tags: [], weight: 0.4, negation, questionType };
  }

  return { id: "general", tags: [], weight: 0, negation, questionType };
}