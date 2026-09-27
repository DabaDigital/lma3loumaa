import { chromium } from "@playwright/test";
const files = ["moutabal-384-52a91daf2232","muhammara-384-a364a61931c4","houmous-shawarma-384-e03ac8f66d0e","triomezzes-384-58a37f253df8"];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1536, height: 384 } });
await page.goto("http://127.0.0.1:5190/");
await page.setContent(`<body style="margin:0;display:flex;background:#fff">${files.map(f=>`<img src="http://127.0.0.1:5190/assets/optimized/${f}.webp" width=384 height=384>`).join("")}</body>`);
await page.waitForTimeout(800);
await page.screenshot({ path: process.argv[2] });
await browser.close();
