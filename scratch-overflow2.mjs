import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 320, height: 844 } });
await ctx.addInitScript(() => localStorage.setItem("lma-language", "ar"));
const page = await ctx.newPage();
for (let i = 0; i < 20; i++) { try { await page.goto("http://127.0.0.1:5191/"); break; } catch { await new Promise((r) => setTimeout(r, 500)); } }
await page.locator(".flavor-feature").waitFor();
await page.locator(".menu-showcase-catalog-trigger").click();
await page.evaluate(() => document.fonts.ready);
console.log(await page.evaluate(() => {
  const out = [document.documentElement.scrollWidth];
  for (const el of document.querySelectorAll("body *")) {
    const b = el.getBoundingClientRect();
    if (b.width && (b.right > innerWidth + 0.5 || b.left < -0.5)) {
      let clipped = false;
      for (let p = el.parentElement; p; p = p.parentElement) { const s = getComputedStyle(p); if (s.overflowX !== "visible" || s.position === "fixed") { clipped = true; break; } }
      if (!clipped && getComputedStyle(el).position !== "fixed") out.push(`${el.tagName}.${el.className} L${Math.round(b.left)} R${Math.round(b.right)} W${Math.round(b.width)} :: ${el.textContent.slice(0, 30)}`);
    }
  }
  return out.slice(0, 20).join("\n");
}));
await browser.close();
