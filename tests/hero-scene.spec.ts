import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

async function story(page: Page) {
  await page.goto("/");
  await expect(page.locator(".hero-story")).toHaveAttribute(
    "data-scroll-enabled",
    "true",
  );
  await expect(page.locator(".shawarma-scene")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.evaluate(() => document.fonts.ready);
  return page.locator(".hero-story").evaluate((element) => {
    const mobile = (element as HTMLElement).dataset.scrollLayout === "mobile";
    const anchor = mobile ? element.querySelector(".hero-art-track")! : element;
    const style = getComputedStyle(element);
    return {
      start:
        scrollY +
        anchor.getBoundingClientRect().top -
        parseFloat(style.getPropertyValue("--story-pin-top")),
      travel: parseFloat(style.getPropertyValue("--hero-travel")),
    };
  });
}

async function scrollTo(page: Page, y: number, progress: number) {
  await page.evaluate(
    (top) => window.scrollTo({ top, behavior: "instant" }),
    y,
  );
  await expect
    .poll(async () =>
      Math.abs(
        Number(
          await page.locator(".shawarma-scene").getAttribute("data-progress"),
        ) - progress,
      ),
    )
    .toBeLessThan(0.012);
}

test("desktop pins the hero, scrubs in both directions, then releases the page", async ({
  page,
}) => {
  const { start, travel } = await story(page);
  await expect(page.locator(".shawarma-reveal-toggle")).toHaveCount(0);
  await scrollTo(page, start + travel * 0.25, 0.25);
  const first = await page.locator(".hero").boundingBox();
  const bread = await page
    .locator(".shawarma-layer--bread")
    .evaluate((element) => getComputedStyle(element).transform);
  await scrollTo(page, start + travel * 0.75, 0.75);
  const second = await page.locator(".hero").boundingBox();
  expect(Math.abs(first!.y - second!.y)).toBeLessThan(2);
  expect(
    await page
      .locator(".shawarma-layer--bread")
      .evaluate((element) => getComputedStyle(element).transform),
  ).not.toBe(bread);
  await scrollTo(page, start + travel, 1);
  await expect(page.locator(".shawarma-scene")).toHaveAttribute(
    "data-expanded",
    "true",
  );
  await scrollTo(page, start + travel + 160, 1);
  expect((await page.locator(".hero").boundingBox())!.y).toBeLessThan(
    second!.y - 140,
  );
  await scrollTo(page, start + travel * 0.25, 0.25);
  await scrollTo(page, 0, 0);
  await expect(page.locator(".hero-food")).toHaveCSS("opacity", "1");
});

test.describe("phone scroll reveal", () => {
  test.use({ hasTouch: true, isMobile: true });
  for (const width of [320, 390]) {
    for (const locale of ["ar", "fr", "en"]) {
      test(`${locale} at ${width}px pins the shawarma at screen center and releases it`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 844 });
        await page.addInitScript(
          (language) => localStorage.setItem("lma-language", language),
          locale,
        );
        const { start, travel } = await story(page);
        expect(start).toBeGreaterThan(0);
        await scrollTo(page, Math.max(0, start - 50), 0);
        await expect(page.locator(".hero-food")).toHaveCSS("opacity", "1");
        await scrollTo(page, start + travel * 0.25, 0.25);
        const first = await page.locator(".hero-art").boundingBox();
        expect(Math.abs(first!.y + first!.height / 2 - 422)).toBeLessThan(2);
        await scrollTo(page, start + travel * 0.75, 0.75);
        const second = await page.locator(".hero-art").boundingBox();
        expect(Math.abs(first!.y - second!.y)).toBeLessThan(2);
        await scrollTo(page, start + travel, 1);
        await expect(page.locator(".shawarma-layers")).toHaveCSS(
          "opacity",
          "1",
        );
        await scrollTo(page, start + travel + 160, 1);
        expect((await page.locator(".hero-art").boundingBox())!.y).toBeLessThan(
          first!.y - 140,
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth - innerWidth,
          ),
        ).toBeLessThanOrEqual(0);
        await scrollTo(page, start + travel * 0.5, 0.5);
        if (locale === "ar")
          await page.screenshot({
            path: `artifacts/hero-animation/scroll-mobile-${width}.png`,
          });
      });
    }
  }
});

test.describe("runway before the artwork", () => {
  test.use({ hasTouch: true, isMobile: true });
  test("is reserved at first paint, so the page does not jump when the layers arrive", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route("**/hero/shawarma-exploded-768.webp", async (route) => {
      await held;
      await route.continue();
    });
    await page.goto("/");
    const story = page.locator(".hero-story");
    await expect(story).toHaveAttribute("data-scroll-runway", "true");
    await expect(story).toHaveAttribute("data-scroll-enabled", "false");
    await page.evaluate(() => document.fonts.ready);
    const text = page.locator(".hero-text");
    const before = (await text.boundingBox())!.y;
    release();
    await expect(story).toHaveAttribute("data-scroll-enabled", "true");
    expect(Math.abs((await text.boundingBox())!.y - before)).toBeLessThan(1);
  });
});

test("reduced motion bypasses the scroll runway", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".hero-story")).toHaveAttribute(
    "data-scroll-enabled",
    "false",
  );
  await expect(page.locator(".shawarma-scroll-cue")).toHaveCount(0);
  await expect(page.locator(".hero-food")).toHaveCSS("animation-name", "none");
  await page.evaluate(() => window.scrollTo({ top: 400, behavior: "instant" }));
  await expect(page.locator(".shawarma-scene")).toHaveAttribute(
    "data-progress",
    "0.0000",
  );
  expect((await page.locator(".hero").boundingBox())!.y).toBeLessThan(0);
});

test("a failed reveal image keeps the original hero and does not pin scrolling", async ({
  page,
}) => {
  await page.route("**/hero/shawarma-exploded-768.webp", (route) =>
    route.abort(),
  );
  await page.goto("/");
  await expect(page.locator(".hero-story")).toHaveAttribute(
    "data-scroll-enabled",
    "false",
  );
  await expect(page.locator(".hero-food")).toHaveCSS("opacity", "1");
  await expect(page.locator(".shawarma-scroll-cue")).toHaveCount(0);
});

test("the menu link can skip the pinned sequence", async ({ page }) => {
  await story(page);
  await page.locator('.hero-buttons a[href="/#menu"]').click();
  await expect(page).toHaveURL(/#menu$/);
  const anchorOffset = await page
    .locator("#menu")
    .evaluate(
      (menu) =>
        parseFloat(
          getComputedStyle(document.documentElement).scrollPaddingTop,
        ) + parseFloat(getComputedStyle(menu).scrollMarginTop),
    );
  await expect
    .poll(async () =>
      Math.abs((await page.locator("#menu").boundingBox())!.y - anchorOffset),
    )
    .toBeLessThan(3);
});
