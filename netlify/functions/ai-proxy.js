/**
 * Netlify Function: AI Proxy
 * Keeps VITE_AI_KEY server-side, never exposed to browser bundle.
 * Called by assistantMatcher.js via POST /.netlify/functions/ai-proxy
 */
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const endpoint = process.env.AI_ENDPOINT || "";
  const key = process.env.AI_KEY || "";
  const model = process.env.AI_MODEL || "gemini-2.5-flash";

  if (!endpoint || !key) {
    return {
      statusCode: 503,
      body: JSON.stringify({ error: "AI service not configured." }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body." }) };
  }

  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: "messages array required." }) };
  }

  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ model, messages }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return {
        statusCode: upstream.status,
        body: JSON.stringify({ error: data?.error?.message || "Upstream error." }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: "Upstream request failed." }),
    };
  }
};
