import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto("http://127.0.0.1:5190/");
await page.locator(".mezze-strip").scrollIntoViewIfNeeded();
await page.waitForTimeout(2000);
console.log(await page.evaluate(() => [...document.querySelectorAll(".mezze-strip-art img, .flavor-feature img, .flavor-thumbnail img")].map((i) => i.getAttribute("src") + " | " + i.className + " | " + i.closest(".food-visual, .mezze-bowl")?.className).join("\n")));
await browser.close();
