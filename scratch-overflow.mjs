import { chromium } from "@playwright/test";
const browser = await chromium.launch();
for (const lang of ["fr", "ar"]) {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 800 } });
  await ctx.addInitScript((l) => localStorage.setItem("lma-language", l), lang);
  const page = await ctx.newPage();
  await page.goto("http://127.0.0.1:5190/");
  await page.locator(".flavor-feature").waitFor();
  await page.evaluate(() => document.fonts.ready);
  console.log(lang, await page.evaluate(() => {
    const out = [document.documentElement.scrollWidth];
    for (const el of document.querySelectorAll("#menu *")) {
      const b = el.getBoundingClientRect();
      if (b.right > innerWidth + 0.5 || b.left < -0.5) {
        let clipped = false;
        for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o !== "visible") { clipped = true; break; } }
        if (!clipped) out.push(`${el.tagName}.${el.className} L${Math.round(b.left)} R${Math.round(b.right)} W${Math.round(b.width)}`);
      }
    }
    return out.slice(0, 15).join("\n");
  }));
  await ctx.close();
}
await browser.close();
