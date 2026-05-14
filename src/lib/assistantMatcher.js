/**
 * Smart Local Matcher for Imzaqi Assistant
 *
 * Strategy: tokenize user query, score each Q&A item by:
 *   - keyword overlap (weighted by tag synonyms)
 *   - q-string similarity (Sørensen–Dice on bigrams)
 *   - tag boost
 * Pick the highest scorer if score > threshold; otherwise fallback.
 *
 * Optionally calls a remote LLM (Gemini/OpenAI) if REACT_APP_AI_ENDPOINT
 * is configured. The response shape is the same as a Q&A item:
 *   { id: "ai-...", q, a: [string], tags: [] }
 */

import { ASSISTANT_QA } from "../data/assistantQA";

// ── Synonym dictionary — maps user words to canonical concept tags ─────
const SYNONYMS = {
  garansi: ["garansi", "warranty", "klaim", "ganti", "replace", "rusak", "diganti"],
  bayar: ["bayar", "payment", "qris", "transfer", "pembayaran", "lunasin", "lunas"],
  status: ["status", "tracking", "track", "progres", "progress", "cek", "check", "lihat", "lacak"],
  produk: ["produk", "varian", "paket", "barang", "akun", "premium", "private", "sharing", "family"],
  akun: ["akun", "login", "password", "email", "credentials", "kredensial"],
  promo: ["promo", "diskon", "discount", "kode", "voucher", "kupon"],
  pengiriman: ["dikirim", "kirim", "wa", "whatsapp", "delivery", "pengiriman"],
  refund: ["refund", "kembali", "balik", "uang"],
  toko: ["toko", "imzaqi", "store", "asli", "original", "aman", "safe", "kontak", "admin", "alamat"],
  netflix: ["netflix"],
  canva: ["canva"],
  chatgpt: ["chatgpt", "gpt", "openai"],
  spotify: ["spotify"],
  youtube: ["youtube", "yt"],
  capcut: ["capcut"],
  duolingo: ["duolingo"],
  viu: ["viu"],
  iqiyi: ["iqiyi"],
};

// Build reverse lookup: word → tag
const WORD_TO_TAG = {};
Object.entries(SYNONYMS).forEach(([tag, words]) => {
  words.forEach((w) => {
    WORD_TO_TAG[w] = tag;
  });
});

const STOPWORDS = new Set([
  "yang", "dan", "di", "ke", "dari", "untuk", "ini", "itu", "saya", "aku",
  "kamu", "anda", "kalo", "kalau", "jika", "atau", "tapi", "tetapi", "juga",
  "ada", "tidak", "bisa", "gak", "ga", "ya", "yg", "the", "a", "an", "is",
  "i", "you", "are", "be", "to", "in", "on", "at", "of", "for", "with",
  "min", "kak", "bang", "halo", "hai", "hello", "dong", "sih", "ya", "nih",
]);

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w && w.length >= 2 && !STOPWORDS.has(w));
}

/** Sørensen–Dice coefficient on bigrams */
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

function scoreItem(item, queryTokens, queryStr) {
  let score = 0;

  // 1) Keyword overlap with q text
  const itemTokens = tokenize(item.q);
  const overlap = queryTokens.filter((t) => itemTokens.includes(t)).length;
  score += overlap * 1.0;

  // 2) Tag match: any query token mapped to an item tag
  const queryTags = new Set();
  queryTokens.forEach((t) => {
    if (WORD_TO_TAG[t]) queryTags.add(WORD_TO_TAG[t]);
  });
  const tagHit = item.tags.filter((tag) => queryTags.has(tag)).length;
  score += tagHit * 1.4;

  // 3) Synonym hit inside Q text bonus
  itemTokens.forEach((t) => {
    if (queryTags.has(WORD_TO_TAG[t])) score += 0.4;
  });

  // 4) String similarity fallback
  const sim = diceCoefficient(queryStr, item.q.toLowerCase());
  score += sim * 1.6;

  return score;
}

/**
 * Try to find the best match locally.
 * Returns { item, score } or null if no good match.
 */
export function findBestMatch(query) {
  const queryStr = String(query || "").toLowerCase().trim();
  if (!queryStr) return null;
  const tokens = tokenize(queryStr);
  if (!tokens.length) return null;

  let best = null;
  let bestScore = 0;

  for (const item of ASSISTANT_QA) {
    const s = scoreItem(item, tokens, queryStr);
    if (s > bestScore) {
      bestScore = s;
      best = item;
    }
  }

  // Threshold: need at least 1.2 to be considered "confident"
  if (bestScore >= 1.2) return { item: best, score: bestScore };
  return null;
}

/**
 * Optional remote LLM call.
 * Configure REACT_APP_AI_ENDPOINT and REACT_APP_AI_KEY in .env.
 * Endpoint should accept POST { messages: [{role, content}] } and return
 * { reply: string }.
 */
async function callLLM(query, history) {
  const endpoint = process.env.REACT_APP_AI_ENDPOINT;
  const key = process.env.REACT_APP_AI_KEY;
  if (!endpoint) return null;

  const systemPrompt = `Kamu adalah Imzaqi Assistant, asisten ramah untuk toko digital subscription Imzaqi Store.
Toko menjual akun premium streaming (Netflix, Spotify, Youtube), tools (ChatGPT, Canva), dll.
Pembayaran via QRIS. Kontak admin: WA 0831-3604-9987.
Garansi tertulis di tiap varian (1 bulan – lifetime).
Jawab singkat, ramah, gunakan Bahasa Indonesia. Maksimal 3 paragraf pendek.
Kalau tidak yakin, sarankan user kontak admin via WA.`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.slice(-4).map((h) => [
      { role: "user", content: h.q },
      { role: "assistant", content: Array.isArray(h.a) ? h.a.join("\n\n") : h.a },
    ]).flat(),
    { role: "user", content: query },
  ];

  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify({ messages }),
      signal: ctrl.signal,
    });
    window.clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const reply = data?.reply || data?.message || data?.text;
    if (typeof reply !== "string" || !reply.trim()) return null;
    return reply.trim();
  } catch {
    return null;
  }
}

/**
 * Main entry: handle a free-text user query.
 * Returns a Q&A-shaped item (id, q, a[], tags).
 */
export async function answerQuery(query, history = []) {
  // 1. Try local smart match first (instant)
  const local = findBestMatch(query);
  if (local && local.score >= 2.4) {
    // High confidence — reuse pre-written answer
    return {
      id: `ai-local-${local.item.id}-${Date.now()}`,
      q: query,
      a: local.item.a,
      tags: local.item.tags,
      _source: "local-strong",
    };
  }

  // 2. Try LLM if configured (more nuanced answers)
  const llmReply = await callLLM(query, history);
  if (llmReply) {
    const paragraphs = llmReply
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    return {
      id: `ai-llm-${Date.now()}`,
      q: query,
      a: paragraphs.length ? paragraphs : [llmReply],
      tags: ["custom"],
      _source: "llm",
    };
  }

  // 3. Medium-confidence local match
  if (local && local.score >= 1.2) {
    return {
      id: `ai-local-${local.item.id}-${Date.now()}`,
      q: query,
      a: [
        "Hmm, mungkin yang kamu maksud ini ya:",
        ...local.item.a,
      ],
      tags: local.item.tags,
      _source: "local-fuzzy",
    };
  }

  // 4. Fallback — defer to admin
  return {
    id: `ai-fallback-${Date.now()}`,
    q: query,
    a: [
      "Maaf, saya kurang yakin paham maksud kamu 🙏",
      "Untuk pertanyaan spesifik, silakan chat admin langsung di **WA: 0831-3604-9987** (https://wa.me/6283136049987) — admin akan respon < 5 menit di jam aktif (08.00–22.00 WIB).",
      "Atau kamu bisa pilih topik lain dari saran di bawah.",
    ],
    tags: [],
    _source: "fallback",
  };
}
