import { expect, test } from "@playwright/test";

const SAMPLE_DONE_ORDER = {
  order_code: "IMZ-DEMO9999",
  status: "done",
  created_at: "2026-11-17T10:00:00Z",
  subtotal_idr: 30000,
  discount_percent: 10,
  total_idr: 27000,
  promo_code: "HEMAT10",
  buyer_email: "pembeli.superpanjang.email.testing@example.com",
  verification_status: "verified",
  notes: "Tolong segera diproses min, dipakai malam ini.",
  admin_note: "Email: akunpremium@example.com\nPassword: PasswordAman123",
  items: [
    {
      product_name: "YouTube & YouTube Music Premium",
      variant_name: "Fam Plan (akun buyer)",
      duration_label: "1 Bulan",
      guarantee_text: "Full garansi",
      requires_buyer_email: true,
      price_idr: 30000,
      qty: 1,
      description: "Bebas iklan pakai link invite ke email pembeli. Garansi sesuai masa aktif.",
    },
  ],
};

const SAMPLE_PENDING_ORDER = {
  order_code: "IMZ-PEND1234",
  status: "pending",
  created_at: "2026-11-17T12:00:00Z",
  reservation_expires_at: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
  subtotal_idr: 15000,
  discount_percent: 0,
  total_idr: 15000,
  promo_code: null,
  verification_status: "unverified",
  items: [
    {
      product_name: "Canva Pro",
      variant_name: "Invite Tim",
      duration_label: "1 Bulan",
      guarantee_text: "Garansi penuh",
      price_idr: 15000,
      qty: 1,
    },
  ],
};

test("status focused view renders done order without overflow or console errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (err) => errors.push(`PageError: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(`ConsoleError: ${msg.text()}`);
    }
  });

  await page.route("**/rest/v1/rpc/get_order_public*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([SAMPLE_DONE_ORDER]),
    });
  });

  await page.route("**/rest/v1/funnel_events*", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  await page.goto("/status?order=IMZ-DEMO9999");
  await expect(page.locator(".st-orderCodeText")).toHaveText("IMZ-DEMO9999");

  await expect(page.locator(".store-hero--status")).toHaveCount(0);
  await expect(page.locator(".st-checkoutSteps")).toHaveCount(0);
  await expect(page.locator(".st-search--compact")).toBeVisible();
  await expect(page.getByText("Total Tagihan")).toHaveCount(1);

  const details = page.locator(".st-itemDescDetails");
  await expect(details).not.toHaveAttribute("open", "");
  expect(await details.evaluate((el) => el.open)).toBe(false);
  await details.locator("summary").click();
  expect(await details.evaluate((el) => el.open)).toBe(true);

  await expect(page.locator(".st-reviewForm")).toHaveCount(0);
  await page.getByRole("button", { name: "5 bintang" }).click();
  await expect(page.locator(".st-reviewForm")).toBeVisible();

  const sizes = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth + 1);
  expect(errors).toEqual([]);
});

test("status pending order shows countdown and single proof WA CTA without overflow", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (err) => errors.push(`PageError: ${err.message}`));

  await page.route("**/rest/v1/rpc/get_order_public*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([SAMPLE_PENDING_ORDER]),
    });
  });

  await page.goto("/status?order=IMZ-PEND1234");
  await expect(page.locator(".st-orderCodeText")).toHaveText("IMZ-PEND1234");
  await expect(page.locator(".st-expiryChip")).toBeVisible();
  await expect(page.getByText("Kirim Bukti via WA")).toHaveCount(1);

  const sizes = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth + 1);
  expect(errors).toEqual([]);
});
