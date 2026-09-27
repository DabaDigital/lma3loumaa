import { chromium } from "@playwright/test";
const out = process.argv[2];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addInitScript(() => localStorage.setItem("lma-language", "ar"));
const page = await ctx.newPage();
await page.goto("http://127.0.0.1:5190/");
await page.evaluate(async () => { await document.fonts.ready; document.documentElement.dataset.motion = "off"; });
const strip = page.locator(".mezze-strip");
await strip.scrollIntoViewIfNeeded();
await page.waitForTimeout(2500);
console.log(JSON.stringify(await page.evaluate(() => {
  const r = (s) => [...document.querySelectorAll(s)].map((e) => { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { s, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), op: cs.opacity, vis: cs.visibility, color: cs.color, cls: e.className }; });
  return [...r(".mezze-strip"), ...r(".mezze-strip-heading h3"), ...r(".mezze-strip-item"), ...r(".mezze-strip-copy p"), ...r(".mezze-strip-choose"), ...r(".mezze-strip-art img")];
}), null, 1));
await page.screenshot({ path: `${out}/mezze-1440.png` });
await browser.close();
