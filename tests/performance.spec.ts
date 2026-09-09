import { test, expect } from "@playwright/test";
import { readFile, stat } from "node:fs/promises";
import imageAssets from "../src/imageAssets.json" with { type: "json" };

test("mobile gets a small, prioritized hero and responsive bundled photos", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const hero = page.locator(".hero-food img");
  await expect(hero).toHaveAttribute("fetchpriority", "high");
  await expect(hero).toHaveAttribute("loading", "eager");
  const image = await hero.evaluate(async (image) => {
    await (image as HTMLImageElement).decode();
    return {
      source: (image as HTMLImageElement).currentSrc,
      decoding: (image as HTMLImageElement).decoding,
    };
  });
  expect(image.source).toMatch(
    /\/optimized\/shawarma-normal-(384|768)-.*\.webp$/,
  );
  expect(image.decoding).toBe("async");
  const path = decodeURIComponent(new URL(image.source).pathname);
  expect((await stat(`public${path}`)).size).toBeLessThan(160_000);
  await expect(page.locator(".location-photo img").first()).toHaveAttribute(
    "loading",
    "lazy",
  );
  expect((await stat("public/assets/favicon.svg")).size).toBeLessThan(60_000);
  expect(await readFile("public/assets/fonts.css", "utf8")).not.toMatch(
    /\.(ttf|otf)\)/,
  );
});

test("every generated responsive variant exists and decodes", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto("/");
  const sources = [
    ...new Set(
      Object.values(imageAssets).flatMap((asset) =>
        asset.srcSet.split(", ").map((candidate) => candidate.split(" ")[0]),
      ),
    ),
  ];
  const failures = await page.evaluate(async (sources) => {
    const failures: string[] = [];
    // Bound concurrent decodes rather than loading every full image at once.
    for (let at = 0; at < sources.length; at += 6) {
      await Promise.all(
        sources.slice(at, at + 6).map(async (src) => {
          const image = new Image();
          image.src = src;
          try {
            await image.decode();
          } catch {
            failures.push(src);
          }
        }),
      );
    }
    return failures;
  }, sources);
  expect(failures).toEqual([]);
});

test("decorative motion pauses when it leaves the viewport and resumes on return", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".hero-food")).toHaveCSS(
    "animation-play-state",
    "running",
  );
  await page.locator("#locations").scrollIntoViewIfNeeded();
  await expect(page.locator(".hero-food")).toHaveCSS(
    "animation-play-state",
    "paused",
  );
  await expect(page.locator(".ticker > div")).toHaveCSS(
    "animation-play-state",
    "paused",
  );
  await page.locator(".hero").scrollIntoViewIfNeeded();
  await expect(page.locator(".hero-food")).toHaveCSS(
    "animation-play-state",
    "running",
  );
});
