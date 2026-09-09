// Run against a production preview: node scripts/measure-performance.mjs before
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { categories, items, locations } from "../src/data.ts";

const label = process.argv[2] || "current";
const origin = process.env.PERFORMANCE_URL || "http://127.0.0.1:4173";
const content = {
  categories: categories.filter((c) => c.id !== "all"),
  menu_items: items,
  locations,
  reviews: [],
};
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    // Stable content, no writes or dependency on production database latency.
    await page.route("**/*.supabase.co/**", (route) => {
      const table = new URL(route.request().url()).pathname.split("/").at(-1);
      return route.fulfill({
        json: (content[table] || []).map((row, sort_order) => ({
          ...row,
          available: true,
          sort_order,
        })),
      });
    });
    await page.addInitScript(() => {
      window.__perf = { lcp: 0, cls: 0, longTasks: [] };
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__perf.lcp = e.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          if (!e.hadRecentInput) window.__perf.cls += e.value;
      }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          window.__perf.longTasks.push(e.duration);
      }).observe({ type: "longtask", buffered: true });
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 100,
      downloadThroughput: 1_600_000 / 8,
      uploadThroughput: 750_000 / 8,
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await page.locator(".hero-food img").evaluate((image) => image.decode());
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1500);
    const result = await page.evaluate(() => ({
      ...window.__perf,
      resources: performance
        .getEntriesByType("resource")
        .map((r) => ({
          name: new URL(r.name).pathname,
          bytes: r.encodedBodySize,
          duration: r.duration,
        })),
      hero: {
        source: document.querySelector(".hero-food img").currentSrc,
        width: document.querySelector(".hero-food img").naturalWidth,
      },
    }));
    result.width = width;
    result.bytes = result.resources.reduce((sum, r) => sum + r.bytes, 0);
    results.push(result);
    await mkdir("artifacts/performance", { recursive: true });
    await page.screenshot({
      path: `artifacts/performance/${label}-${width}.png`,
    });
    await context.close();
    console.log(
      JSON.stringify({
        label,
        width,
        lcp: result.lcp,
        cls: result.cls,
        bytes: result.bytes,
        longTasks: result.longTasks.length,
      }),
    );
  }
  await writeFile(
    `artifacts/performance/${label}.json`,
    JSON.stringify(results, null, 2),
  );
} finally {
  await browser.close();
}
