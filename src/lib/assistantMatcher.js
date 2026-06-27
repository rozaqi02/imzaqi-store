/**
 * Context-aware Smart Matcher for Imzaqi AI
 *
 * Scoring layers:
 *   - token overlap + Dice similarity + synonym tags
 *   - intent detection boost (order, payment, warranty, …)
 *   - route context + conversation history signals
 *   - entity extraction (IMZ-XXXX, product aliases)
 *
 * Optionally calls remote LLM when VITE_AI_ENDPOINT is set.
 */

import { ASSISTANT_QA } from "../data/assistantQA";
import {
  buildAssistantContext,
  detectIntent,
} from "./assistantContext";
import { warn, info } from "./log";

const SYNONYMS = {
  garansi: ["garansi", "warranty", "klaim", "ganti", "replace", "rusak", "diganti", "logout", "ke-logout"],
  bayar: ["bayar", "payment", "qris", "transfer", "pembayaran", "lunasin", "lunas", "pending", "scan"],
  status: ["status", "tracking", "track", "progres", "progress", "cek", "check", "lihat", "lacak", "order"],
  produk: ["produk", "varian", "paket", "barang", "akun", "premium", "private", "sharing", "family", "stok"],
  akun: ["akun", "login", "password", "email", "credentials", "kredensial", "sandiku"],
  promo: ["promo", "diskon", "discount", "kode", "voucher", "kupon"],
  pengiriman: ["dikirim", "kirim", "wa", "whatsapp", "delivery", "pengiriman", "datang"],
  refund: ["refund", "kembali", "balik", "uang", "batal", "cancel"],
  toko: ["toko", "imzaqi", "store", "asli", "original", "aman", "safe", "kontak", "admin", "alamat", "cs"],
  netflix: ["netflix", "nflx"],
  canva: ["canva"],
  chatgpt: ["chatgpt", "gpt", "openai"],
  spotify: ["spotify", "spo"],
  youtube: ["youtube", "yt", "yutub"],
  capcut: ["capcut"],
  duolingo: ["duolingo"],
  viu: ["viu"],
  iqiyi: ["iqiyi", "iqy"],
  disney: ["disney", "disney+", "disneyplus"],
  prime: ["prime", "amazon", "prime video"],
};

const WORD_TO_TAG = {};
Object.entries(SYNONYMS).forEach(([tag, words]) => {
  words.forEach((w) => {
    WORD_TO_TAG[w] = tag;
  });
});

const SLANG_MAP = {
  gmn: "gimana",
  gmna: "gimana",
  gimna: "gimana",
  gmana: "gimana",
  gimane: "gimana",
  brp: "berapa",
  brpa: "berapa",
  bbrp: "berapa",
  kpn: "kapan",
  trms: "terima kasih",
  makasi: "makasih",
  mks: "makasih",
  thx: "thanks",
  tq: "thanks",
  blm: "belum",
  udh: "sudah",
  udah: "sudah",
  sdh: "sudah",
  gk: "tidak",
  gak: "tidak",
  ga: "tidak",
  gausah: "tidak usah",
  dong: "",
  sih: "",
  nih: "",
  deh: "",
  ya: "",
  yah: "",
  woi: "",
  woy: "",
  min: "",
  kak: "",
  bang: "",
  bro: "",
  sis: "",
  wkwk: "",
  wk: "",
  ajg: "",
  anjir: "",
  parah: "",
  bgt: "banget",
  bngt: "banget",
  bener: "benar",
  bnr: "benar",
  jdi: "jadi",
  jd: "jadi",
  tau: "tahu",
  tw: "tahu",
  gtu: "gitu",
  gt: "gitu",
  ky: "kayak",
  kyk: "kayak",
  kaya: "kayak",
  dr: "dari",
  mo: "mau",
  mw: "mau",
  pengen: "mau",
  pg: "mau",
};

const STOPWORDS = new Set([
  "yang", "dan", "di", "ke", "dari", "untuk", "ini", "itu", "saya", "aku",
  "kamu", "anda", "kalo", "kalau", "jika", "atau", "tapi", "tetapi", "juga",
  "ada", "tidak", "bisa", "ya", "yg", "the", "a", "an", "is",
  "i", "you", "are", "be", "to", "in", "on", "at", "of", "for", "with",
  "halo", "hai", "hello", "permisi", "tolong", "mohon", "please",
]);

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function expandSlang(text) {
  return normalizeText(text)
    .split(" ")
    .map((w) => SLANG_MAP[w] ?? w)
    .filter(Boolean)
    .join(" ");
}

function tokenize(text) {
  return expandSlang(text)
    .split(/\s+/)
    .filter((w) => w && w.length >= 2 && !STOPWORDS.has(w));
}

function diceCoefficient(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const grams = (s) => {
    const out = new Map();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      out.set(g, (out.get(g) || 0) + 1);
    }
    return out;
  };
  const aG = grams(a);
  const bG = grams(b);
  let inter = 0;
  let aSum = 0;
  let bSum = 0;
  aG.forEach((v) => { aSum += v; });
  bG.forEach((v) => { bSum += v; });
  aG.forEach((v, k) => {
    if (bG.has(k)) inter += Math.min(v, bG.get(k));
  });
  return (2 * inter) / Math.max(1, aSum + bSum);
}

function collectQueryTags(tokens, entities) {
  const tags = new Set();
  tokens.forEach((t) => {
    if (WORD_TO_TAG[t]) tags.add(WORD_TO_TAG[t]);
  });
  (entities.products || []).forEach((p) => tags.add(p));
  return tags;
}

function getAnswerText(item) {
  return (item.a || []).join(" ").toLowerCase();
}

function scoreItem(item, queryTokens, queryStr, context, intent) {
  let score = 0;
  const { historySignals, route, entities, isFollowUp, questionType } = context;
  const itemTokens = tokenize(item.q);
  const answerTokens = tokenize(getAnswerText(item));
  const queryTags = collectQueryTags(queryTokens, entities);

  const overlapQ = queryTokens.filter((t) => itemTokens.includes(t)).length;
  const overlapA = queryTokens.filter((t) => answerTokens.includes(t)).length;
  const tagHit = item.tags.filter((tag) => queryTags.has(tag)).length;

  const hasOverlap = overlapQ > 0 || overlapA > 0 || tagHit > 0 || (entities.orderCodes?.length > 0 && item.tags.includes("status"));
  if (!hasOverlap) return 0;

  score += overlapQ * 1.2;
  score += overlapA * 0.95;
  score += tagHit * 1.75;

  itemTokens.forEach((t) => {
    if (queryTags.has(WORD_TO_TAG[t])) score += 0.5;
  });
  answerTokens.forEach((t) => {
    if (queryTags.has(WORD_TO_TAG[t])) score += 0.35;
  });

  if (intent?.tags?.length) {
    const intentHit = item.tags.filter((tag) => intent.tags.includes(tag)).length;
    score += intentHit * (intent.weight || 1) * 0.95;
  }

  if (route?.tags?.length) {
    const routeHit = item.tags.filter((tag) => route.tags.includes(tag)).length;
    score += routeHit * 0.62;
  }

  if (historySignals?.tags?.length) {
    const histHit = item.tags.filter((tag) => historySignals.tags.includes(tag)).length;
    score += histHit * (isFollowUp ? 1.05 : 0.7);
  }

  if (entities.products?.length) {
    const prodHit = item.tags.filter((tag) => entities.products.includes(tag)).length;
    score += prodHit * 2.0;
    const corpus = `${item.q} ${getAnswerText(item)}`;
    entities.products.forEach((p) => {
      if (corpus.includes(p)) score += 1.35;
    });
  }

  if (entities.orderCodes?.length && item.tags.includes("status")) {
    score += 1.8;
  }

  if (historySignals?.lastQuestion) {
    score += diceCoefficient(expandSlang(historySignals.lastQuestion), item.q.toLowerCase()) * 1.05;
  }

  if (questionType === "how" && /cara|gimana|bagaimana/i.test(item.q)) score += 0.8;
  if (questionType === "how_much" && /berapa|harga|murah/i.test(`${item.q} ${getAnswerText(item)}`)) score += 1.0;
  if (questionType === "when" && /kapan|lama|estimasi/i.test(`${item.q} ${getAnswerText(item)}`)) score += 0.9;
  if (questionType === "why" && /kenapa|karena/i.test(getAnswerText(item))) score += 0.7;
  if (intent?.negation && /tidak|belum|gagal|belum/i.test(getAnswerText(item))) score += 0.65;

  const simQ = diceCoefficient(queryStr, item.q.toLowerCase());
  const simA = diceCoefficient(queryStr, getAnswerText(item));

  // Prevent false positive matching on single common question words
  if (overlapQ === 1 && overlapA === 0 && tagHit === 0) {
    const questionWords = ["berapa", "kapan", "gimana", "bagaimana", "apa", "apakah", "mana", "siapa", "kenapa", "mengapa", "kok"];
    const matchedToken = queryTokens.find((t) => itemTokens.includes(t));
    if (questionWords.includes(matchedToken) && simQ < 0.45) {
      return 0;
    }
  }

  score += simQ * 2.0;
  score += simA * 1.1;

  return score;
}

function getAdaptiveThreshold(context, intent) {
  let base = 1.15;
  if (intent?.weight >= 2) base -= 0.25;
  if (context.isFollowUp && context.historySignals?.tags?.length) base -= 0.1;
  if (context.route) base -= 0.08;
  if (intent?.id === "short") base += 0.35;
  return Math.max(0.75, base);
}

function getStrongThreshold(context) {
  let base = 2.35;
  if (context.isFollowUp && context.historySignals?.tags?.length) base -= 0.2;
  if (context.route) base -= 0.15;
  return Math.max(1.85, base);
}

/**
 * Rank all Q&A items; returns [{ item, score }] sorted desc.
 */
export function findBestMatches(query, contextInput = {}, limit = 3) {
  const context = contextInput.pathname !== undefined
    ? contextInput
    : buildAssistantContext({ query, ...contextInput });

  const effectiveQuery = context.resolvedQuery || query;
  const queryStr = expandSlang(effectiveQuery);
  if (!queryStr) return [];

  const tokens = tokenize(queryStr);
  if (!tokens.length && !context.entities?.orderCodes?.length) return [];

  const intent = detectIntent(query, context);
  const ranked = [];

  for (const item of ASSISTANT_QA) {
    const s = scoreItem(item, tokens, queryStr, context, intent);
    if (s > 0) ranked.push({ item, score: s });
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit);
}

export function findBestMatch(query, contextInput = {}) {
  const matches = findBestMatches(query, contextInput, 1);
  return matches[0] || null;
}

function buildContextualLead(context, intent, query) {
  const parts = [];
  const { route, entities, isFollowUp, historySignals } = context;

  if (isFollowUp && historySignals?.lastQuestion) {
    parts.push(`Oke, lanjut dari topik **"${historySignals.lastQuestion}"**:`);
  }

  if (entities.orderCodes?.length) {
    const code = entities.orderCodes[0];
    parts.push(`Aku catat order **${code}** — cek progresnya di tab **Status Order** atau lanjut tanya di sini.`);
  }

  if (entities.products?.length && ["product", "comparison", "followup"].includes(intent?.id)) {
    const names = entities.products.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(", ");
    parts.push(`Soal **${names}**, ini yang perlu kamu tahu:`);
  }

  if (route?.tip && !parts.length && intent?.weight < 2.2) {
    parts.push(`Kamu di halaman **${route.label}** — ${route.tip}`);
  }

  return parts;
}

function handleSpecialIntent(intent, context, query) {
  const { route } = context;

  if (intent.id === "greeting") {
    const routeLine = route
      ? `Kamu lagi di **${route.label}**. ${route.tip}`
      : "Pilih topik di bawah atau ketik pertanyaanmu — aku bantu jawab cepat.";
    return {
      id: `ai-greet-${Date.now()}`,
      q: query,
      a: [
        "Hai 👋 Senang kamu mampir!",
        routeLine,
      ],
      tags: route?.tags || ["toko"],
      _source: "intent-greeting",
    };
  }

  if (intent.id === "thanks") {
    return {
      id: `ai-thanks-${Date.now()}`,
      q: query,
      a: [
        "Sama-sama 🙏 Senang bisa bantu.",
        "Kalau masih ada yang mau ditanyakan, lanjut aja di sini atau chat admin di **WA: 0831-3604-9987** (https://wa.me/6283136049987).",
      ],
      tags: ["toko"],
      _source: "intent-thanks",
    };
  }

  return null;
}

function synthesizeLocalAnswer(matches, context, intent, query) {
  const threshold = getAdaptiveThreshold(context, intent);
  const strongThreshold = getStrongThreshold(context);

  if (!matches.length || matches[0].score < threshold) return null;

  const special = handleSpecialIntent(intent, context, query);
  if (special) return special;

  const top = matches[0];
  const lead = buildContextualLead(context, intent, query);

  const closeMatches = matches.filter(
    (m) => m.score >= threshold && top.score - m.score <= 0.65
  );

  if (closeMatches.length >= 2 && top.score < strongThreshold) {
    const merged = [];
    if (lead.length) merged.push(...lead);
    merged.push("Ini beberapa info yang mungkin kamu butuhkan:");
    closeMatches.slice(0, 2).forEach((m, i) => {
      merged.push(`**${i + 1}.** ${m.item.a[0]}`);
    });
    if (closeMatches[0].item.a.length > 1) {
      merged.push(...closeMatches[0].item.a.slice(1));
    }
    return {
      id: `ai-merge-${top.item.id}-${Date.now()}`,
      q: query,
      a: merged,
      tags: [...new Set(closeMatches.flatMap((m) => m.item.tags))],
      _source: "local-merge",
    };
  }

  if (top.score >= strongThreshold) {
    const answer = lead.length ? [...lead, ...top.item.a] : top.item.a;
    return {
      id: `ai-local-${top.item.id}-${Date.now()}`,
      q: query,
      a: answer,
      tags: top.item.tags,
      _source: "local-strong",
    };
  }

  return {
    id: `ai-local-${top.item.id}-${Date.now()}`,
    q: query,
    a: [
      ...(lead.length ? lead : ["Hmm, mungkin yang kamu maksud ini ya:"]),
      ...top.item.a,
    ],
    tags: top.item.tags,
    _source: "local-fuzzy",
  };
}

function buildLLMSystemPrompt(context, intent) {
  const { route, entities, historySignals } = context;
  const lines = [
    "Kamu adalah Imzaqi AI, asisten cerdas untuk toko digital subscription Imzaqi Store.",
    "Jawab pertanyaan pengguna dengan ramah, komunikatif, dan gunakan Bahasa Indonesia. Gunakan emoji secara wajar.",
    "Berikan kebebasan penuh kepada pengguna untuk bertanya hal apa pun (termasuk topik umum seperti matematika, sains, sejarah, pemrograman, dll.). Jangan batasi jawabanmu hanya dalam lingkup Imzaqi Store. Jawablah pertanyaan umum tersebut secara cerdas, akurat, dan lengkap.",
    "Namun, jika pengguna menanyakan hal yang spesifik tentang pembelian, produk, garansi, pembayaran, atau status pesanan di Imzaqi Store, gunakan informasi konteks toko berikut untuk menjawab:",
    "  - Toko menjual akun premium streaming (Netflix, Spotify, Youtube, Disney+, Viu, Iqiyi, Prime Video) dan tools (ChatGPT, Canva, CapCut, Duolingo, dll.) secara 100% online.",
    "  - Pembayaran dilakukan via scan QRIS otomatis setelah checkout.",
    "  - Produk dikirim via WhatsApp (WA) setelah pembayaran terkonfirmasi (biasanya 5-30 menit untuk ready stock).",
    "  - Garansi ganti akun (replace) jika terjadi kendala (tiba-tiba ter-logout) selama periode garansi yang tertulis di detail varian.",
    "  - Kontak CS/Admin WA: 0831-3604-9987 (https://wa.me/6283136049987), aktif jam 08.00–22.00 WIB.",
    "Jawablah dengan singkat dan padat (maksimal 3 paragraf pendek)."
  ];

  if (route) {
    lines.push(`User sedang berada di halaman: ${route.label}.`);
  }
  if (entities.orderCodes?.length) {
    lines.push(`ID Order yang disebut user: ${entities.orderCodes.join(", ")}.`);
  }
  if (entities.products?.length) {
    lines.push(`Nama produk yang disebut user: ${entities.products.join(", ")}.`);
  }
  if (historySignals?.lastQuestion) {
    lines.push(`Pertanyaan terakhir user: "${historySignals.lastQuestion}".`);
  }
  if (context.isFollowUp) {
    lines.push("Ini pertanyaan lanjutan — jawab dengan merujuk konteks sebelumnya.");
  }
  if (context.resolvedQuery && context.resolvedQuery !== context.originalQuery) {
    lines.push(`Query diperluas: "${context.resolvedQuery}".`);
  }
  if (intent?.negation) {
    lines.push("User menyatakan negasi (belum/tidak) — sesuaikan jawaban.");
  }

  return lines.join("\n");
}

let _llmConfigLogged = false;

async function callLLM(query, history, context, intent) {
  let endpoint = (import.meta.env.VITE_AI_ENDPOINT || "").replace(/^"|"$/g, "").trim();
  let key = (import.meta.env.VITE_AI_KEY || "").replace(/^"|"$/g, "").trim();
  const model = (import.meta.env.VITE_AI_MODEL || "gemini-2.5-flash").replace(/^"|"$/g, "").trim();

  if (!_llmConfigLogged) {
    _llmConfigLogged = true;
    info("[Imzaqi AI] Config:", {
      endpoint: endpoint ? `${endpoint.slice(0, 30)}...` : "(empty)",
      keyPresent: key.length > 0,
      model,
    });
  }

  if (!endpoint || !endpoint.startsWith("http")) {
    warn("[Imzaqi AI] No valid endpoint configured:", endpoint || "(empty)");
    return null;
  }

  const systemPrompt = buildLLMSystemPrompt(context, intent);

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.slice(-6).map((h) => [
      { role: "user", content: h.q },
      { role: "assistant", content: Array.isArray(h.a) ? h.a.join("\n\n") : h.a },
    ]).flat(),
    { role: "user", content: query },
  ];

  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(key ? { "Authorization": `Bearer ${key}` } : {}),
      },
      body: JSON.stringify({ model, messages }),
      signal: ctrl.signal,
    });
    window.clearTimeout(timer);

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      warn("[Imzaqi AI] LLM API error:", res.status, errBody.slice(0, 200));
      return null;
    }

    const data = await res.json();
    const reply =
      data?.choices?.[0]?.message?.content ||
      data?.reply ||
      data?.message ||
      data?.text;

    if (typeof reply !== "string" || !reply.trim()) {
      warn("[Imzaqi AI] LLM returned empty reply:", JSON.stringify(data).slice(0, 200));
      return null;
    }
    return reply.trim();
  } catch (err) {
    warn("[Imzaqi AI] LLM fetch failed:", err?.name, err?.message);
    return null;
  }
}

export async function answerQuery(query, history = [], options = {}) {
  const { pathname = "/" } = options;
  const context = buildAssistantContext({ pathname, history, query });
  const intent = detectIntent(query, context);

  // ALWAYS call LLM first, giving it absolute priority
  const llmReply = await callLLM(query, history, context, intent);
  if (llmReply) {
    const paragraphs = llmReply
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    const body = paragraphs.length ? paragraphs : [llmReply];
    return {
      id: `ai-llm-${Date.now()}`,
      q: query,
      a: body,
      tags: intent.tags?.length ? intent.tags : ["custom"],
      _source: "llm",
    };
  }

  // Fallback: try local matching (normal threshold)
  const matches = findBestMatches(query, context, 4);
  const local = synthesizeLocalAnswer(matches, context, intent, query);
  if (local) return local;

  // Lenient fallback: if we have ANY match (even below threshold), show it
  if (matches.length && matches[0].score > 0.15) {
    const top = matches[0];
    return {
      id: `ai-local-lenient-${Date.now()}`,
      q: query,
      a: [
        "Hmm, ini jawaban terdekat yang aku temukan:",
        ...top.item.a,
        "Kalau belum sesuai, coba tanya dengan kata kunci lain atau hubungi admin di **WA: 0831-3604-9987**.",
      ],
      tags: top.item.tags || [],
      _source: "local-lenient",
    };
  }

  // Ultimate fallback — no LLM and no local match at all
  return {
    id: `ai-fallback-${Date.now()}`,
    q: query,
    a: [
      "Maaf, aku belum bisa menjawab pertanyaan ini karena server AI sedang gangguan.",
      "Coba beberapa saat lagi, atau langsung hubungi admin di **WA: 0831-3604-9987** (https://wa.me/6283136049987) untuk bantuan cepat.",
    ],
    tags: [],
    _source: "fallback",
  };
}