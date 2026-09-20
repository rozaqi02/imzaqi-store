import { expect, test } from "@playwright/test";

for (const path of ["/", "/produk", "/status", "/checkout"]) {
  test(`${path} does not overflow horizontally`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const sizes = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth + 1);
  });
}

test("status lookup remains keyboard reachable", async ({ page }) => {
  await page.goto("/status");
  const input = page.getByPlaceholder("IMZ-ABCD1234");
  await input.focus();
  await expect(input).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Cek status" })).toBeFocused();
});
