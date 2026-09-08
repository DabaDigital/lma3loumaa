/**
 * Re-encodes the menu cut-outs as WebP next to the supplied PNGs.
 *
 * The PNGs are ~4.5 MB in total and every menu card loads one. WebP keeps the
 * alpha channel these cut-outs depend on, at a fraction of the bytes. The PNGs
 * are left in place as the source of truth and as the <picture> fallback.
 *
 * Encoding happens in Chromium's canvas, so this needs no native image
 * dependency beyond the Playwright browser the test suite already installs.
 *
 * Usage: node scripts/menu-images-webp.mjs [--apply]
 */
import { chromium } from "@playwright/test";
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../public/assets/menu");
const apply = process.argv.includes("--apply");
const files = readdirSync(dir).filter((f) => f.endsWith(".png")).sort();

const browser = await chromium.launch();
const page = await browser.newPage();
let pngTotal = 0;
let webpTotal = 0;

for (const file of files) {
  const png = readFileSync(join(dir, file));
  const dataUrl = "data:image/png;base64," + png.toString("base64");
  const encoded = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext("2d").drawImage(img, 0, 0);
    return c.toDataURL("image/webp", 0.9);
  }, dataUrl);

  if (!encoded.startsWith("data:image/webp"))
    throw new Error(`WebP encoding unavailable (got ${encoded.slice(0, 30)})`);

  const webp = Buffer.from(encoded.split(",")[1], "base64");
  pngTotal += png.length;
  webpTotal += webp.length;
  const saved = (100 - (webp.length / png.length) * 100).toFixed(0);
  console.log(
    `${file.padEnd(34)} ${(png.length / 1024).toFixed(0).padStart(4)}KB -> ` +
      `${(webp.length / 1024).toFixed(0).padStart(4)}KB  (-${saved}%)`,
  );
  if (apply) writeFileSync(join(dir, file.replace(/\.png$/, ".webp")), webp);
}

await browser.close();
console.log(
  `\nTotal ${(pngTotal / 1024 / 1024).toFixed(2)}MB -> ` +
    `${(webpTotal / 1024 / 1024).toFixed(2)}MB ` +
    `(-${(100 - (webpTotal / pngTotal) * 100).toFixed(0)}%)`,
);
console.log(apply ? "WebP written." : "Dry run. Re-run with --apply.");
