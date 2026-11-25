const crypto = require("crypto");

const DEFAULT_ADMIN_PHONE = "6283136049987";

function normalizeWaTarget(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  // Preserve WhatsApp Group JIDs (e.g. 120363022293150720@g.us) and comma-separated targets
  if (value.includes("@g.us")) {
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => (part.includes("@g.us") ? part : normalizeWaTarget(part)))
      .join(",");
  }
  let digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  return digits;
}

function formatIdr(amount) {
  const n = Number(amount || 0);
  if (!Number.isFinite(n)) return "Rp0";
  return `Rp${new Intl.NumberFormat("id-ID").format(Math.round(n))}`;
}

function timingSafeEquals(a, b) {
  const bufA = Buffer.from(String(a || ""), "utf8");
  const bufB = Buffer.from(String(b || ""), "utf8");
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function readHeader(headers, name) {
  if (!headers || typeof headers !== "object") return "";
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) return String(value || "");
  }
  return "";
}

function parseOrderItems(rawItems) {
  if (Array.isArray(rawItems)) return rawItems;
  if (typeof rawItems === "string") {
    try {
      const parsed = JSON.parse(rawItems);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function buildOrderMessage(payload) {
  const type = String(payload?.type || "INSERT").toUpperCase();
  const order = payload?.record || payload?.order || {};
  const isPaymentReported =
    type === "UPDATE" && String(order.status || "").toLowerCase() === "paid_reported";

  const heading = isPaymentReported
    ? "💳 *Bukti Bayar Masuk — Imzaqi Store*"
    : "🛒 *Order Baru — Imzaqi Store*";

  const items = parseOrderItems(order.items);
  const itemLines = items.length
    ? items
        .slice(0, 10)
        .map((it) => {
          const qty = Number(it?.qty || 1);
          const name = String(it?.product_name || "Produk").trim();
          const variant = String(it?.variant_name || "").trim();
          const label = variant ? `${name} (${variant})` : name;
          return `• ${qty}× ${label}`;
        })
        .join("\n")
    : "• (detail item lihat di dashboard admin)";

  const extraItemsNote =
    items.length > 10 ? `\n• ...dan ${items.length - 10} item lainnya` : "";

  const lines = [
    heading,
    "",
    `ID Order: *${order.order_code || "-"}*`,
    `Status: ${order.status || "pending"}`,
    `Total: *${formatIdr(order.total_idr)}*`,
    `WA Pembeli: ${order.customer_whatsapp || "-"}`,
  ];

  if (order.buyer_email) lines.push(`Email Pembeli: ${order.buyer_email}`);
  if (order.promo_code) lines.push(`Promo: ${order.promo_code} (-${order.discount_percent || 0}%)`);

  lines.push("", "Item:", `${itemLines}${extraItemsNote}`);

  if (order.notes) {
    lines.push("", `Catatan: ${String(order.notes).trim().slice(0, 240)}`);
  }

  if (order.payment_proof_url) {
    lines.push("", `Bukti bayar: ${order.payment_proof_url}`);
  }

  return lines.join("\n");
}

function shouldNotifyEvent(payload, notifyOn = "all") {
  const mode = String(notifyOn || "all").toLowerCase();
  const type = String(payload?.type || "").toUpperCase();
  const record = payload?.record || {};
  const oldRecord = payload?.old_record || {};

  if (type === "INSERT") {
    return mode === "all" || mode === "insert";
  }

  if (type === "UPDATE") {
    const nextStatus = String(record.status || "").toLowerCase();
    const prevStatus = String(oldRecord.status || "").toLowerCase();
    const becamePaidReported = nextStatus === "paid_reported" && prevStatus !== "paid_reported";
    const proofNewlyAdded = Boolean(record.payment_proof_url) && !oldRecord.payment_proof_url;
    return (mode === "all" || mode === "paid_reported") && (becamePaidReported || proofNewlyAdded);
  }

  return false;
}

async function sendViaFonnte({ phone, message, token, fetchImpl }) {
  const res = await fetchImpl("https://api.fonnte.com/send", {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      target: phone,
      message,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.status === false) {
    throw new Error(body?.reason || body?.detail || `Fonnte error (${res.status})`);
  }
  return body;
}

async function sendViaCallMeBot({ phone, message, token, fetchImpl }) {
  const url =
    `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}` +
    `&text=${encodeURIComponent(message)}` +
    `&apikey=${encodeURIComponent(token)}`;
  const res = await fetchImpl(url, { method: "GET" });
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`CallMeBot error (${res.status}): ${text}`);
  }
  return { ok: true, response: text };
}

async function sendViaMeta({ phone, message, token, phoneNumberId, fetchImpl }) {
  if (!phoneNumberId) {
    throw new Error("WA_META_PHONE_NUMBER_ID belum diatur.");
  }
  const res = await fetchImpl(
    `https://graph.facebook.com/v20.0/${encodeURIComponent(phoneNumberId)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: message },
      }),
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error?.message || `Meta Cloud API error (${res.status})`);
  }
  return body;
}

async function dispatchWhatsApp({ provider, phone, message, token, phoneNumberId, fetchImpl = fetch }) {
  const normalized = String(provider || "fonnte").trim().toLowerCase();
  if (normalized === "callmebot") {
    return sendViaCallMeBot({ phone, message, token, fetchImpl });
  }
  if (normalized === "meta") {
    return sendViaMeta({ phone, message, token, phoneNumberId, fetchImpl });
  }
  return sendViaFonnte({ phone, message, token, fetchImpl });
}

exports.normalizeWaTarget = normalizeWaTarget;
exports.normalizeWaPhone = normalizeWaTarget;
exports.buildOrderMessage = buildOrderMessage;
exports.shouldNotifyEvent = shouldNotifyEvent;
exports.dispatchWhatsApp = dispatchWhatsApp;

exports.handler = async (event, _context, deps = {}) => {
  if (event?.httpMethod && event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const webhookSecret = String(process.env.WA_WEBHOOK_SECRET || "").trim();
  if (webhookSecret) {
    const incomingSecret =
      readHeader(event?.headers, "x-webhook-secret") ||
      readHeader(event?.headers, "authorization").replace(/^Bearer\s+/i, "").trim();
    if (!timingSafeEquals(incomingSecret, webhookSecret)) {
      return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    }
  }

  let payload;
  try {
    payload = typeof event?.body === "string" ? JSON.parse(event.body || "{}") : (event?.body || {});
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON payload" }) };
  }

  if (payload?.table && payload.table !== "orders") {
    return { statusCode: 200, body: JSON.stringify({ skipped: true, reason: "ignored_table" }) };
  }

  const notifyOn = process.env.WA_NOTIFY_ON || "all";
  if (!shouldNotifyEvent(payload, notifyOn)) {
    return { statusCode: 200, body: JSON.stringify({ skipped: true, reason: "event_filtered" }) };
  }

  const token = String(process.env.WA_API_TOKEN || "").trim();
  if (!token) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "WA_API_TOKEN belum diatur di environment variables." }),
    };
  }

  const phone = normalizeWaTarget(
    process.env.WA_TARGET || process.env.WA_ADMIN_PHONE || DEFAULT_ADMIN_PHONE
  );
  const provider = process.env.WA_PROVIDER || "fonnte";
  const phoneNumberId = process.env.WA_META_PHONE_NUMBER_ID || "";
  const message = buildOrderMessage(payload);

  try {
    const result = await dispatchWhatsApp({
      provider,
      phone,
      message,
      token,
      phoneNumberId,
      fetchImpl: deps.fetchImpl || fetch,
    });
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, provider, result }),
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err?.message || "Gagal mengirim notifikasi WhatsApp" }),
    };
  }
};
