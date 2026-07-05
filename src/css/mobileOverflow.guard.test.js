import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readCss(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

describe("mobile overflow guards", () => {
  it("clips ProductDetail page width on mobile", () => {
    const css = readCss("css/pages/ProductDetail.css");
    expect(css).toMatch(/overflow-x:\s*clip/);
    expect(css).toMatch(/\.detail-page\.detail-page-v3/);
  });

  it("clips Pay page width on mobile", () => {
    const css = readCss("css/pages/Pay.css");
    expect(css).toMatch(/overflow-x:\s*clip/);
    expect(css).toMatch(/\.pay-page/);
  });

  it("clips Catalog page width on mobile", () => {
    const css = readCss("css/pages/Products.css");
    expect(css).toMatch(/overflow-x:\s*clip/);
    expect(css).toMatch(/\.catalog-page/);
  });

  it("constrains Checkout drawer on mobile", () => {
    const css = readCss("css/pages/Checkout.css");
    expect(css).toMatch(/overflow-x:\s*clip/);
    expect(css).toMatch(/\.checkout-drawer/);
  });

  it("protects Status page text containers on mobile", () => {
    const css = readCss("css/pages/Status.css");
    expect(css).toMatch(/overflow-wrap:\s*anywhere/);
    expect(css).toMatch(/min-width:\s*0/);
  });
});