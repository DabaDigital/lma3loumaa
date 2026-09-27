import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("http://127.0.0.1:5190/");
await page.locator(".mezze-strip").scrollIntoViewIfNeeded();
await page.waitForTimeout(3000);
console.log(await page.evaluate(async () => {
  const out = [];
  for (const img of document.querySelectorAll(".mezze-strip img, .flavor-feature img:not(.flavor-backdrop)")) {
    const i = new Image(); i.crossOrigin = "anonymous"; i.src = img.currentSrc || img.src;
    try { await i.decode(); } catch (e) { out.push("decode fail " + i.src); continue; }
    const c = document.createElement("canvas"); c.width = i.naturalWidth; c.height = i.naturalHeight;
    const x = c.getContext("2d"); x.drawImage(i, 0, 0);
    try { const d = x.getImageData(2, 2, 1, 1).data; out.push(`${i.naturalWidth}x${i.naturalHeight} corner rgba=${[...d]}`); } catch (e) { out.push("tainted " + e.message); }
  }
  return out.join("\n");
}));
await browser.close();
