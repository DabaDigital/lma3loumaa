import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

async function openStory(page: Page) {
  await page.goto("/");
  await expect(page.locator(".hero-story")).toHaveAttribute(
    "data-scroll-enabled",
    "true",
  );
  expect(
    await page
      .locator(".shawarma-layer img")
      .evaluateAll((images) =>
        images.every(
          (image) =>
            (image as HTMLImageElement).complete &&
            (image as HTMLImageElement).naturalWidth > 0,
        ),
      ),
  ).toBe(true);
  await page.evaluate(() => document.fonts.ready);
  await page.locator(".shawarma-depth").evaluate(async (element) => {
    await Promise.allSettled(
      element
        .getAnimations()
        .filter((animation) =>
          Number.isFinite(animation.effect?.getComputedTiming().endTime),
        )
        .map((animation) => animation.finished),
    );
  });
  // Hold ambient movement steady so comparisons isolate scroll-driven rotation.
  await page.locator(".shawarma-motion-toggle").click();
  await page.mouse.move(0, 0);
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

async function scrub(
  page: Page,
  story: { start: number; travel: number },
  progress: number,
  webgl = true,
) {
  const target = await page.evaluate(
    ({ start, travel, progress }) => {
      window.scrollTo({ top: start + travel * progress, behavior: "instant" });
      // Browsers round the requested scroll offset to a physical CSS pixel.
      return Math.max(0, Math.min(1, (scrollY - start) / travel));
    },
    { ...story, progress },
  );
  const scene = page.locator(".shawarma-scene");
  await expect
    .poll(async () =>
      Math.abs(Number(await scene.getAttribute("data-progress")) - target),
    )
    .toBeLessThan(0.0006);
  // Wait for the shared easing to settle before comparing exact rendered views.
  await expect(scene).toHaveAttribute("data-progress", target.toFixed(4));
  const rendered = await scene.getAttribute("data-progress");
  expect(
    await page
      .locator(".hero-story")
      .evaluate((element) =>
        (element as HTMLElement).style.getPropertyValue("--reveal"),
      ),
  ).toBe(rendered);
  if (webgl) {
    const canvas = page.locator("canvas.rotisserie-model");
    await expect(canvas).toHaveAttribute("data-rendered-progress", rendered!);
    expect(
      Math.abs(
        Number(await canvas.getAttribute("data-angle")) -
          (20 + Number(rendered) * 180),
      ),
    ).toBeLessThan(0.011);
  }
}

async function expectSmallObject(page: Page) {
  const art = (await page.locator(".hero-art").boundingBox())!;
  const object = (await page.locator(".shawarma-rotisserie").boundingBox())!;
  expect(object.width / art.width).toBeLessThan(0.35);
  expect(object.height / art.height).toBeLessThan(0.6);
  expect(object.width).toBeGreaterThan(0);
  expect(object.height).toBeGreaterThan(0);
  expect(object.x).toBeGreaterThanOrEqual(art.x - 1);
  expect(object.y).toBeGreaterThanOrEqual(art.y - 1);
  expect(object.x + object.width).toBeLessThanOrEqual(art.x + art.width + 1);
  expect(object.y + object.height).toBeLessThanOrEqual(art.y + art.height + 1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
}

test("the small 3D rotisserie rotates with scroll and reverses to the same view", async ({
  page,
}) => {
  const story = await openStory(page);
  await expect(page.locator(".shawarma-rotisserie")).toHaveAttribute(
    "data-renderer",
    "webgl",
  );
  const canvas = page.locator("canvas.rotisserie-model");
  await scrub(page, story, 0);
  await expectSmallObject(page);
  await page.screenshot({
    path: "artifacts/hero-animation/rotisserie-desktop-closed.png",
  });

  await scrub(page, story, 0.2);
  const first = await canvas.screenshot();
  const firstAngle = Number(await canvas.getAttribute("data-angle"));
  await scrub(page, story, 0.6);
  const forward = await canvas.screenshot();
  expect(Number(await canvas.getAttribute("data-angle"))).toBeGreaterThan(
    firstAngle,
  );
  expect(forward.equals(first)).toBe(false);
  await scrub(page, story, 0.2);
  expect(Number(await canvas.getAttribute("data-angle"))).toBe(firstAngle);
  expect((await canvas.screenshot()).equals(first)).toBe(true);

  await scrub(page, story, 0.65);
  await expectSmallObject(page);
  await page.screenshot({
    path: "artifacts/hero-animation/rotisserie-desktop-open.png",
  });
});

test("a scroll jump eases both hero objects together without overshooting", async ({
  page,
}) => {
  const story = await openStory(page);
  await expect(page.locator(".shawarma-rotisserie")).toHaveAttribute(
    "data-renderer",
    "webgl",
  );
  await scrub(page, story, 0.2);
  const result = await page.evaluate(async ({ start, travel }) => {
    const scene = document.querySelector<HTMLElement>(".shawarma-scene")!;
    const hero = document.querySelector<HTMLElement>(".hero-story")!;
    const canvas = document.querySelector<HTMLCanvasElement>(
      "canvas.rotisserie-model",
    )!;
    const initial = Number(scene.dataset.progress);
    window.scrollTo({ top: start + travel * 0.6, behavior: "instant" });
    const target = Math.max(0, Math.min(1, (scrollY - start) / travel));
    const settled = target.toFixed(4);
    const samples: {
      progress: number;
      reveal: number;
      rendered: number;
      angle: number;
    }[] = [];
    await new Promise<void>((resolve) => {
      const sample = () => {
        samples.push({
          progress: Number(scene.dataset.progress),
          reveal: Number(hero.style.getPropertyValue("--reveal")),
          rendered: Number(canvas.dataset.renderedProgress),
          angle: Number(canvas.dataset.angle),
        });
        if (scene.dataset.progress === settled) resolve();
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    return { initial, target, samples };
  }, story);

  expect(
    result.samples.some(
      ({ progress }) =>
        progress > result.initial + 0.002 && progress < result.target - 0.002,
    ),
  ).toBe(true);
  let previous = result.initial;
  for (const sample of result.samples) {
    expect(sample.progress).toBeGreaterThanOrEqual(previous);
    expect(sample.progress).toBeLessThanOrEqual(result.target + 0.0001);
    expect(sample.reveal).toBe(sample.progress);
    expect(sample.rendered).toBe(sample.progress);
    expect(Math.abs(sample.angle - (20 + sample.progress * 180))).toBeLessThan(
      0.011,
    );
    previous = sample.progress;
  }
  await scrub(page, story, 0.2);
});

test.describe("small rotisserie on phones", () => {
  test.use({ hasTouch: true, isMobile: true });
  for (const width of [320, 390]) {
    test(`stays secondary and inside the hero at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript(() =>
        localStorage.setItem("lma-language", "ar"),
      );
      const story = await openStory(page);
      await expect(page.locator(".shawarma-rotisserie")).toHaveAttribute(
        "data-renderer",
        "webgl",
      );
      await scrub(page, story, 0);
      await expectSmallObject(page);
      await scrub(page, story, 0.65);
      await expectSmallObject(page);
      if (width === 390)
        await page.screenshot({
          path: "artifacts/hero-animation/rotisserie-mobile-390-open.png",
        });
    });
  }
});

test("reduced motion keeps a visible static cutout without scroll rotation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const object = page.locator(".shawarma-rotisserie");
  const photo = object.locator("img");
  await expect(object).toHaveAttribute("data-renderer", "image");
  await expect(photo).toBeVisible();
  await expect(photo).toHaveCSS("opacity", "1");
  await expect
    .poll(() => photo.evaluate((image) => image.naturalWidth))
    .toBeGreaterThan(0);
  await expect(object.locator("canvas")).toHaveCSS("opacity", "0");
  await expect(page.locator(".hero-story")).toHaveAttribute(
    "data-scroll-enabled",
    "false",
  );
  await page.evaluate(() => window.scrollTo({ top: 400, behavior: "instant" }));
  await expect(page.locator(".shawarma-scene")).toHaveAttribute(
    "data-progress",
    "0.0000",
  );
  expect(await object.locator("canvas").getAttribute("data-angle")).toBeNull();
});

test("unavailable WebGL retains the cutout and the main scroll reveal", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      ...args: unknown[]
    ) {
      if (kind === "webgl") return null;
      return Reflect.apply(original, this, [kind, ...args]);
    } as typeof original;
  });
  const story = await openStory(page);
  const object = page.locator(".shawarma-rotisserie");
  const photo = object.locator("img");
  await expect
    .poll(() => photo.evaluate((image) => image.naturalWidth))
    .toBeGreaterThan(0);
  await expect(object).toHaveAttribute("data-renderer", "image");
  await expect(photo).toHaveCSS("opacity", "1");
  await expect(object.locator("canvas")).toHaveCSS("opacity", "0");
  await scrub(page, story, 0.6, false);
  await expect(photo).toBeVisible();
  await expect(page.locator(".shawarma-layers")).toHaveCSS("opacity", "1");
  await scrub(page, story, 1, false);
  await expect(page.locator(".shawarma-scene")).toHaveAttribute(
    "data-expanded",
    "true",
  );
});
