import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import notifyOrderWa from "../../netlify/functions/notify-order-wa.js";

const { handler, buildOrderMessage, normalizeWaPhone, shouldNotifyEvent } = notifyOrderWa;

const sampleInsertPayload = {
  type: "INSERT",
  table: "orders",
  record: {
    id: "ord-1",
    order_code: "IMZ-20261125-01",
    status: "pending",
    total_idr: 45000,
    customer_whatsapp: "081234567890",
    buyer_email: "buyer@example.com",
    items: [
      { product_name: "Claude Pro", variant_name: "Sharing 5 User", qty: 1 },
    ],
    notes: "Proses cepat ya min",
  },
};

describe("notify-order-wa function", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      WA_API_TOKEN: "test-token",
      WA_ADMIN_PHONE: "083136049987",
      WA_WEBHOOK_SECRET: "secret-123",
      WA_PROVIDER: "fonnte",
      WA_NOTIFY_ON: "all",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("normalizes Indonesian phone numbers to 62 prefix", () => {
    expect(normalizeWaPhone("083136049987")).toBe("6283136049987");
    expect(normalizeWaPhone("+62 831-3604-9987")).toBe("6283136049987");
  });

  it("formats order details into a clear WhatsApp message", () => {
    const msg = buildOrderMessage(sampleInsertPayload);
    expect(msg).toContain("Order Baru");
    expect(msg).toContain("IMZ-20261125-01");
    expect(msg).toContain("Claude Pro (Sharing 5 User)");
    expect(msg).toContain("Rp45.000");
    expect(msg).toContain("081234567890");
  });

  it("rejects unauthorized webhook calls when WA_WEBHOOK_SECRET is configured", async () => {
    const res = await handler({
      httpMethod: "POST",
      headers: { "x-webhook-secret": "wrong" },
      body: JSON.stringify(sampleInsertPayload),
    });
    expect(res.statusCode).toBe(401);
  });

  it("sends WhatsApp notification via Fonnte on order INSERT", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: true, id: "msg-1" }),
    });

    const res = await handler(
      {
        httpMethod: "POST",
        headers: { "x-webhook-secret": "secret-123" },
        body: JSON.stringify(sampleInsertPayload),
      },
      {},
      { fetchImpl: fetchMock }
    );

    expect(res.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.fonnte.com/send");
    expect(init.headers.Authorization).toBe("test-token");
    const sentBody = JSON.parse(init.body);
    expect(sentBody.target).toBe("6283136049987");
    expect(sentBody.message).toContain("IMZ-20261125-01");
  });

  it("supports CallMeBot provider and filters irrelevant UPDATE events", async () => {
    expect(
      shouldNotifyEvent(
        {
          type: "UPDATE",
          record: { status: "processing" },
          old_record: { status: "paid_reported" },
        },
        "all"
      )
    ).toBe(false);

    process.env.WA_PROVIDER = "callmebot";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "Message queued",
    });

    const res = await handler(
      {
        httpMethod: "POST",
        headers: { "x-webhook-secret": "secret-123" },
        body: JSON.stringify({
          type: "UPDATE",
          table: "orders",
          record: {
            ...sampleInsertPayload.record,
            status: "paid_reported",
            payment_proof_url: "https://cdn/proof.jpg",
          },
          old_record: {
            ...sampleInsertPayload.record,
            status: "pending",
            payment_proof_url: null,
          },
        }),
      },
      {},
      { fetchImpl: fetchMock }
    );

    expect(res.statusCode).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toContain("https://api.callmebot.com/whatsapp.php");
    expect(fetchMock.mock.calls[0][0]).toContain("phone=6283136049987");
  });
});
