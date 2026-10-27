import { describe, it, expect } from "vitest";
import { compressImage } from "./imageCompress";

describe("compressImage", () => {
  it("returns null or non-image files as-is", async () => {
    expect(await compressImage(null)).toBe(null);
    const textFile = new File(["hello"], "test.txt", { type: "text/plain" });
    expect(await compressImage(textFile)).toBe(textFile);
  });

  it("passes SVG and GIF files as-is without canvas rasterization", async () => {
    const svgFile = new File(["<svg></svg>"], "icon.svg", { type: "image/svg+xml" });
    expect(await compressImage(svgFile)).toBe(svgFile);

    const gifFile = new File(["gifdata"], "anim.gif", { type: "image/gif" });
    expect(await compressImage(gifFile)).toBe(gifFile);
  });
});
