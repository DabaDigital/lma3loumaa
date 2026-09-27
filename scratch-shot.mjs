import { chromium } from "@playwright/test";
const [out, langs = "ar", widthsArg = "1900,1440,1100,900,390", category = ""] = process.argv.slice(2);
const browser = await chromium.launch();
for (const lang of langs.split(","))
for (const w of widthsArg.split(",").map(Number)) {
  const mobile = w < 700;
  const ctx = await browser.newContext({ viewport: { width: w, height: mobile ? 844 : 960 }, deviceScaleFactor: mobile ? 2 : 1 });
  await ctx.addInitScript((l) => localStorage.setItem("lma-language", l), lang);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  await page.goto("http://127.0.0.1:5190/");
  await page.locator(".flavor-feature").waitFor();
  await page.evaluate(async () => { await document.fonts.ready; document.documentElement.dataset.motion = "off"; document.documentElement.style.scrollBehavior = "auto"; document.querySelectorAll(".reveal").forEach((e) => e.classList.add("is-visible")); document.querySelectorAll("img[loading=lazy]").forEach((i) => (i.loading = "eager")); });
  if (category) {
    const btn = page.locator(".menu-showcase-categories > button").filter({ hasText: category });
    if (await btn.count()) await btn.first().click();
    else { await page.locator(".menu-showcase-more summary").click(); await page.locator(".menu-showcase-more-panel button").filter({ hasText: category }).click(); }
  }
  const settle = async () => { await page.waitForFunction(() => [...document.querySelectorAll("#menu img")].every((i) => i.complete && !i.classList.contains("skeleton-image")), null, { timeout: 15000 }).catch(() => console.log("images not settled")); await page.waitForTimeout(500); };
  const tag = `${lang}-${w}${category ? "-" + category.replace(/\W+/g, "") : ""}`;
  const check = await page.evaluate(() => {
    const r = (s) => document.querySelector(s)?.getBoundingClientRect();
    const hit = (a, b) => a && b && a.width && b.width && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const intro = [r(".menu-showcase-intro h2"), r(".menu-showcase-intro p")];
    const bad = [".flavor-neighbor--previous", ".flavor-neighbor--next", ".flavor-arrow--previous", ".flavor-arrow--next", ".flavor-meal-control", ".flavor-main-art"].filter((s) => intro.some((i) => hit(i, r(s))));
    return { overflow: document.documentElement.scrollWidth > innerWidth, introOverlaps: bad };
  });
  console.log(tag, JSON.stringify(check));
  await page.evaluate(() => document.querySelector("#menu").scrollIntoView({ block: "start" }));
  await settle();
  await page.screenshot({ path: `${out}/${tag}-a.png` });
  await page.evaluate((m) => { const s = document.querySelector(".mezze-strip"); s.scrollIntoView({ block: m ? "center" : "end" }); }, mobile);
  await settle();
  await page.screenshot({ path: `${out}/${tag}-b.png` });
  await ctx.close();
}
await browser.close();
