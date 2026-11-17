import { expect, test } from "@playwright/test";

function makeFakeJwt(payload) {
  const b64url = (obj) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.fakesig`;
}

async function setupMockAdminRoutes(page) {
  const userId = "00000000-0000-4000-8000-000000000001";
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + 7200;
  const user = {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email: "admin@imzaqi.store",
    app_metadata: { role: "admin", provider: "email" },
    user_metadata: { role: "admin" },
    created_at: new Date().toISOString(),
  };
  const sessionPayload = {
    access_token: makeFakeJwt({
      sub: userId,
      role: "authenticated",
      exp: expSec,
      email: user.email,
      app_metadata: { role: "admin" },
    }),
    refresh_token: "mock-refresh-token",
    token_type: "bearer",
    expires_in: 7200,
    expires_at: expSec,
    user,
  };

  await page.addInitScript(() => {
    localStorage.setItem("imzaqi-theme-v2", "light");
  });

  await page.route("**/auth/v1/token*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(sessionPayload) })
  );

  await page.route("**/auth/v1/user*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) })
  );

  await page.route("**/rest/v1/rpc/*", (route) => {
    const url = route.request().url();
    if (url.includes("is_admin")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(true) });
    }
    if (url.includes("get_public_stats")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ total_views: 1842, today_views: 64, total_orders: 98, today_orders: 3 }]),
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });

  await page.route("**/rest/v1/**", (route) => {
    const url = route.request().url();
    if (url.includes("/admin_users")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user_id: userId }) });
    }
    if (url.includes("/orders")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "content-range": "0-1/2" },
        body: JSON.stringify([
          {
            id: "ord-1",
            order_code: "IMZ-DEMO1001",
            created_at: new Date().toISOString(),
            status: "pending",
            subtotal_idr: 15000,
            discount_percent: 0,
            total_idr: 15000,
            customer_whatsapp: "6281234567890",
            notes: "Tolong segera ya min",
            items: [{ product_name: "YouTube Premium", variant_name: "FamPlan", duration_label: "1 Bulan", qty: 1, price_idr: 15000 }],
          },
          {
            id: "ord-2",
            order_code: "IMZ-DEMO1002",
            created_at: new Date(Date.now() - 3600_000).toISOString(),
            status: "done",
            subtotal_idr: 30000,
            discount_percent: 10,
            total_idr: 27000,
            promo_code: "HEMAT10",
            customer_whatsapp: "6289876543210",
            items: [{ product_name: "Canva Pro", variant_name: "Invite Tim", duration_label: "1 Bulan", qty: 1, price_idr: 30000 }],
          },
        ]),
      });
    }
    if (url.includes("/products")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "prod-1",
            name: "YouTube Premium",
            slug: "youtube-premium",
            category: "streaming",
            is_active: true,
            sort_order: 10,
            product_variants: [
              { id: "var-1", product_id: "prod-1", name: "FamPlan", duration_label: "1 Bulan", price_idr: 15000, stock: 1, is_active: true },
            ],
          },
        ]),
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });
}

test("admin dashboard shell renders KPI strip, topbar, drawer, and zero horizontal overflow", async ({ page }) => {
  await setupMockAdminRoutes(page);

  await page.goto("/admin");
  await page.getByLabel("Email").fill("admin@imzaqi.store");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Masuk admin" }).click();

  await expect(page.locator(".adm-topbar")).toBeVisible();
  await expect(page.locator(".admin-kpiStrip")).toBeVisible();
  await expect(page.locator(".admin-kpiCard")).toHaveCount(4);

  // Strict palette: no blue/amber/purple KPI icon variants
  await expect(page.locator(".admin-kpiIcon.is-blue, .admin-kpiIcon.is-amber, .admin-kpiIcon.is-purple")).toHaveCount(0);

  // Light mode uses near-white light grey sidebar, Dark mode uses solid black sidebar; neutral grey scrollbars
  const lightChecks = await page.evaluate(() => {
    const sidebar = document.querySelector(".adm-sidebar");
    const activeNav = document.querySelector(".adm-navItem.is-active");
    const dangerFoot = document.querySelector(".adm-footBtn--danger");
    const htmlStyle = getComputedStyle(document.documentElement);
    return {
      sidebarBg: sidebar ? getComputedStyle(sidebar).backgroundColor : "",
      activeNavBg: activeNav ? getComputedStyle(activeNav).backgroundImage : "",
      dangerColor: dangerFoot ? getComputedStyle(dangerFoot).color : "",
      scrollbarColor: htmlStyle.scrollbarColor,
    };
  });
  expect(lightChecks.sidebarBg).toBe("rgb(244, 244, 245)");
  expect(lightChecks.activeNavBg).toBe("none");
  expect(lightChecks.dangerColor).toBe("rgb(10, 10, 10)");
  expect(lightChecks.scrollbarColor).not.toContain("0, 194, 208");

  // Verify vertical scroll works natively on Overview (mobile & tablet viewports)
  const scrollBefore = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
    scrollY: window.scrollY,
  }));
  expect(scrollBefore.scrollHeight).toBeGreaterThan(scrollBefore.clientHeight + 60);

  await page.evaluate(() => window.scrollTo(0, 320));
  const afterScroll = await page.evaluate(() => window.scrollY);
  expect(afterScroll).toBeGreaterThan(150);
  await page.evaluate(() => window.scrollTo(0, 0));

  // Switch theme from Topbar button and re-verify black sidebar stays black
  await page.getByRole("button", { name: "Ubah ke tema gelap" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const darkSidebarBg = await page.evaluate(() => getComputedStyle(document.querySelector(".adm-sidebar")).backgroundColor);
  expect(darkSidebarBg).toBe("rgb(10, 10, 10)");

  // On mobile/tablet (<= 1100), topbar hamburger opens slide-over sidebar drawer
  await page.getByRole("button", { name: "Buka menu navigasi" }).click();
  await expect(page.locator(".adm-sidebar.is-mobile-open")).toBeVisible();

  // Navigate to Orders via drawer and close drawer cleanly
  await page.locator(".adm-sidebar").getByRole("button", { name: /Pesanan/i }).click();
  await expect(page.locator(".adm-breadcrumb strong")).toHaveText("Pesanan");
  await expect(page.getByText("IMZ-DEMO1001")).toBeVisible();

  // Strictly no slate-navy card tint or amber left bar in Orders
  const orderChecks = await page.evaluate(() => {
    const item = document.querySelector(".admin-orderListItem");
    return {
      bg: item ? getComputedStyle(item).backgroundColor : "",
      beforeBg: item ? getComputedStyle(item, "::before").backgroundColor : "",
    };
  });
  expect(orderChecks.bg).toBe("rgb(22, 22, 22)");
  expect(orderChecks.beforeBg).not.toBe("rgb(245, 158, 11)");

  const sizes = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth + 1);
});
