import { test, expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

async function openScene(page: Page) {
  await page.goto("/");
  const scene = page.locator(".shawarma-scene");
  await expect(scene).toHaveAttribute("data-ready", "true");
  await scene.scrollIntoViewIfNeeded();
  return scene;
}

async function settleScene(scene: Locator) {
  await scene.evaluate(async (element) => {
    // Let React's new state generate transitions before waiting for them.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    await Promise.allSettled(
      element
        .getAnimations({ subtree: true })
        .filter(
          (animation) =>
            animation.playState === "running" &&
            Number.isFinite(animation.effect?.getComputedTiming().endTime),
        )
        .map((animation) => animation.finished),
    );
  });
}

async function pointAtScene(page: Page, scene: Locator) {
  const box = await scene.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width * 0.78, box!.y + box!.height * 0.3);
}

async function nextFrames(scene: Locator) {
  await scene.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

test("shawarma reveal works with a mouse and both keyboard activation keys", async ({
  page,
}) => {
  const scene = await openScene(page);
  const toggle = page.locator(".shawarma-reveal-toggle");
  await expect(toggle).toHaveAccessibleName(/\S/);
  await expect(toggle).toHaveAttribute("aria-controls", "shawarma-layers");
  await expect(page.locator("#shawarma-layers .shawarma-layer")).toHaveCount(4);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(scene).toHaveAttribute("data-expanded", "false");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(scene).toHaveAttribute("data-expanded", "true");

  await toggle.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(scene).toHaveAttribute("data-expanded", "false");
  await expect(toggle).toBeFocused();

  await toggle.press("Space");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(scene).toHaveAttribute("data-expanded", "true");
  await toggle.click();
  await expect(scene).toHaveAttribute("data-expanded", "false");
});

test.describe("touch phone ingredient reveal", () => {
  test.use({ hasTouch: true, isMobile: true });

  for (const width of [320, 390]) {
    for (const locale of ["ar", "fr", "en"]) {
      test(`${locale} at ${width}px keeps the opened ingredients inside the artwork`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 844 });
        await page.addInitScript((language) => {
          localStorage.setItem("lma-language", language);
        }, locale);
        const scene = await openScene(page);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        const toggle = page.locator(".shawarma-reveal-toggle");
        await toggle.tap();
        await expect(scene).toHaveAttribute("data-expanded", "true");
        await settleScene(scene);

        const layout = await page.locator(".hero-art").evaluate((art) => {
          const frame = art.getBoundingClientRect();
          const image = art.querySelector<HTMLImageElement>(
            ".shawarma-layer img",
          )!;
          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const context = canvas.getContext("2d")!;
          context.drawImage(image, 0, 0);
          const pixels = context.getImageData(
            0,
            0,
            canvas.width,
            canvas.height,
          ).data;
          return {
            overflow: document.documentElement.scrollWidth - innerWidth,
            layers: Array.from(
              art.querySelectorAll<HTMLElement>(".shawarma-layer"),
            ).map((layer) => {
              // Each ingredient uses a clipped region of one transparent atlas.
              // Its full DOM box includes the other three, invisible ingredients.
              const inset = getComputedStyle(layer)
                .clipPath.replace(/^inset\(|\)$/g, "")
                .split(/\s+/);
              const edges = [
                inset[0],
                inset[1] ?? inset[0],
                inset[2] ?? inset[0],
                inset[3] ?? inset[1] ?? inset[0],
              ];
              const pixelInset = (
                value: string,
                size: number,
                naturalSize: number,
              ) =>
                value.endsWith("%")
                  ? (parseFloat(value) / 100) * naturalSize
                  : (parseFloat(value) / size) * naturalSize;
              const top = Math.ceil(
                pixelInset(edges[0], layer.clientHeight, canvas.height),
              );
              const right =
                canvas.width -
                Math.ceil(
                  pixelInset(edges[1], layer.clientWidth, canvas.width),
                );
              const bottom =
                canvas.height -
                Math.ceil(
                  pixelInset(edges[2], layer.clientHeight, canvas.height),
                );
              const left = Math.ceil(
                pixelInset(edges[3], layer.clientWidth, canvas.width),
              );
              let minX = canvas.width,
                minY = canvas.height,
                maxX = -1,
                maxY = -1;
              for (let y = top; y < bottom; y++) {
                for (let x = left; x < right; x++) {
                  if (pixels[(y * canvas.width + x) * 4 + 3] < 8) continue;
                  minX = Math.min(minX, x);
                  minY = Math.min(minY, y);
                  maxX = Math.max(maxX, x + 1);
                  maxY = Math.max(maxY, y + 1);
                }
              }
              // Invisible measurement points inherit the same perspective and
              // rotation as the photo; no rendering style is changed for the test.
              const corners = [
                [minX, minY],
                [maxX, minY],
                [minX, maxY],
                [maxX, maxY],
              ].map(([x, y]) => {
                const point = document.createElement("span");
                point.style.cssText = `position:absolute;visibility:hidden;width:0;height:0;left:${(x / canvas.width) * layer.clientWidth}px;top:${(y / canvas.height) * layer.clientHeight}px`;
                layer.append(point);
                const projected = point.getBoundingClientRect();
                point.remove();
                return projected;
              });
              const bounds = {
                left: Math.min(...corners.map((point) => point.left)),
                top: Math.min(...corners.map((point) => point.top)),
                right: Math.max(...corners.map((point) => point.right)),
                bottom: Math.max(...corners.map((point) => point.bottom)),
              };
              return {
                width: maxX - minX,
                height: maxY - minY,
                left: bounds.left - frame.left,
                top: bounds.top - frame.top,
                right: frame.right - bounds.right,
                bottom: frame.bottom - bounds.bottom,
              };
            }),
          };
        });
        expect(
          layout.overflow,
          "the hero must not create horizontal scrolling",
        ).toBeLessThanOrEqual(0);
        expect(layout.layers).toHaveLength(4);
        for (const [index, layer] of layout.layers.entries()) {
          expect(
            layer.width,
            `ingredient ${index + 1} has visible width`,
          ).toBeGreaterThan(0);
          expect(
            layer.height,
            `ingredient ${index + 1} has visible height`,
          ).toBeGreaterThan(0);
          for (const edge of ["left", "top", "right", "bottom"] as const) {
            expect(
              layer[edge],
              `ingredient ${index + 1} stays inside the ${edge} edge`,
            ).toBeGreaterThanOrEqual(-2);
          }
        }
        await toggle.tap();
        await expect(scene).toHaveAttribute("data-expanded", "false");
      });
    }
  }
});

test("pointer depth resets on leave and the motion control stops and resumes it", async ({
  page,
}) => {
  const scene = await openScene(page);
  await settleScene(scene);
  const depth = scene.locator(".shawarma-depth");
  const motion = page.locator(".shawarma-motion-toggle");
  const resting = await depth.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  await expect(motion).toHaveAttribute("aria-pressed", "false");

  await pointAtScene(page, scene);
  await expect
    .poll(() =>
      depth.evaluate((element) => getComputedStyle(element).transform),
    )
    .not.toBe(resting);
  await page.mouse.move(0, 0);
  await expect(depth).toHaveCSS("transform", resting);

  await motion.click();
  await expect(motion).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() =>
      depth.evaluate((element) => {
        const transform = getComputedStyle(element).transform;
        return (
          transform === "none" || new DOMMatrixReadOnly(transform).isIdentity
        );
      }),
    )
    .toBe(true);
  const pausedTransform = await depth.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  await pointAtScene(page, scene);
  await nextFrames(scene);
  await expect(depth).toHaveCSS("transform", pausedTransform);
  expect(
    await scene.evaluate((element) =>
      element
        .getAnimations({ subtree: true })
        .some((animation) => animation.playState === "running"),
    ),
    "pausing also stops decorative scene animations",
  ).toBe(false);

  await motion.click();
  await expect(motion).toHaveAttribute("aria-pressed", "false");
  await pointAtScene(page, scene);
  await expect
    .poll(() =>
      depth.evaluate((element) => getComputedStyle(element).transform),
    )
    .not.toBe(resting);
});

test("reduced motion keeps the reveal usable without animation or pointer tilt", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const scene = await openScene(page);
  const depth = scene.locator(".shawarma-depth");
  const resting = await depth.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  await pointAtScene(page, scene);
  await nextFrames(scene);
  await expect(depth).toHaveCSS("transform", resting);

  await page.locator(".shawarma-reveal-toggle").click();
  await expect(scene).toHaveAttribute("data-expanded", "true");
  await pointAtScene(page, scene);
  await nextFrames(scene);
  await expect(depth).toHaveCSS("transform", resting);
  expect(
    await scene.evaluate((element) =>
      element
        .getAnimations({ subtree: true })
        .some((animation) => animation.playState === "running"),
    ),
    "reduced motion must also cover newly revealed layers",
  ).toBe(false);
});
