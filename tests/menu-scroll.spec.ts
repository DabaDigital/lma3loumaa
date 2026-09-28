import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

async function runway(page: Page) {
  const root = page.locator(".menu-showcase-runway");
  await expect(root).toHaveAttribute("data-pinned", "true");
  await page.evaluate(() => document.fonts.ready);
  return root.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      start:
        scrollY +
        element.getBoundingClientRect().top -
        parseFloat(style.getPropertyValue("--showcase-pin-top")),
      travel: parseFloat(style.getPropertyValue("--showcase-travel")),
      names: [...element.querySelectorAll(".flavor-slide h3")].map(
        (heading) => heading.textContent ?? "",
      ),
    };
  });
}

const scrollTo = (page: Page, top: number) =>
  page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), top);

test("scrolling slides the shawarmas sideways, then releases the page", async ({
  page,
}) => {
  await page.goto("/");
  const { start, travel, names } = await runway(page);
  expect(names.length).toBeGreaterThan(2);
  const step = travel / (names.length - 1);
  const carousel = page.getByRole("region", { name: "Découvrez nos saveurs" });
  const heading = carousel.locator(".flavor-feature").getByRole("heading");
  const stage = page.locator(".menu-showcase-stage");

  let pinnedAt: number | undefined;
  for (const [index, name] of names.entries()) {
    await scrollTo(page, start + step * index);
    await expect(heading).toHaveText(name);
    const { y } = (await stage.boundingBox())!;
    pinnedAt ??= y;
    expect(Math.abs(y - pinnedAt)).toBeLessThan(2);
  }

  // Halfway between two dishes, both are off-center, one on each side.
  await scrollTo(page, start + step * 1.5);
  const halo = (await carousel.locator(".flavor-halo").boundingBox())!;
  const middle = halo.x + halo.width / 2;
  await expect
    .poll(async () => {
      const sides = await carousel
        .locator(".flavor-slide")
        .evaluateAll((slides) =>
          slides.slice(1, 3).map((slide) => {
            const box = slide.getBoundingClientRect();
            return box.left + box.width / 2;
          }),
        );
      return sides.every((x) => Math.abs(x - middle) > 120);
    })
    .toBe(true);

  // After the last dish the page moves on to the mezze.
  await scrollTo(page, start + travel + 300);
  await expect(heading).toHaveText(names.at(-1)!);
  expect((await stage.boundingBox())!.y).toBeLessThan(pinnedAt! - 250);
  await expect(page.locator(".mezze-strip")).toBeInViewport();

  // Scrolling back brings the dishes back in reverse.
  await scrollTo(page, start + step);
  await expect(heading).toHaveText(names[1]);
});

test("arrows jump the pinned page to a dish; categories hold the stage still", async ({
  page,
}) => {
  await page.goto("/");
  const { start, travel, names } = await runway(page);
  const step = travel / (names.length - 1);
  const carousel = page.getByRole("region", { name: "Découvrez nos saveurs" });
  const heading = carousel.locator(".flavor-feature").getByRole("heading");
  const stage = page.locator(".menu-showcase-stage");
  const root = page.locator(".menu-showcase-runway");

  await scrollTo(page, start + step);
  await expect(heading).toHaveText(names[1]);
  await carousel
    .getByRole("button", { name: "Saveur suivante", exact: true })
    .click();
  await expect(heading).toHaveText(names[2]);
  expect(
    Math.abs((await page.evaluate(() => scrollY)) - (start + step * 2)),
  ).toBeLessThan(3);

  // Other categories are a plain carousel: the runway collapses under the
  // visitor without moving the stage.
  const pinnedAt = (await stage.boundingBox())!.y;
  const categories = page.locator(".menu-showcase-categories");
  await categories.getByRole("button", { name: "Mezzés", exact: true }).click();
  await expect(root).toHaveAttribute("data-pinned", "false");
  await expect(heading).toHaveText("Houmous");
  expect(Math.abs((await stage.boundingBox())!.y - pinnedAt)).toBeLessThan(2);
  const before = await page.evaluate(() => scrollY);
  await carousel
    .getByRole("button", { name: "Saveur suivante", exact: true })
    .click();
  await expect(heading).not.toHaveText("Houmous");
  expect(await page.evaluate(() => scrollY)).toBe(before);

  // Back on the shawarmas, the runway starts again from the first one.
  await categories
    .getByRole("button", { name: "Shawarmas", exact: true })
    .click();
  await expect(root).toHaveAttribute("data-pinned", "true");
  await expect(heading).toHaveText(names[0]);
  expect(Math.abs((await stage.boundingBox())!.y - pinnedAt)).toBeLessThan(2);
});

test("reduced motion keeps the shawarmas a carousel", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const root = page.locator(".menu-showcase-runway");
  await expect(root).toHaveAttribute("data-pinned", "false");
  const carousel = page.getByRole("region", { name: "Découvrez nos saveurs" });
  const heading = carousel.locator(".flavor-feature").getByRole("heading");
  await carousel
    .getByRole("button", { name: "Saveur suivante", exact: true })
    .click();
  await expect(heading).toHaveText("Lma3louma Cheddar");
});

test.describe("phone", () => {
  test.use({ hasTouch: true, isMobile: true });
  test("pins the shawarmas above the order bar and pages through them", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => localStorage.setItem("lma-language", "ar"));
    await page.goto("/");
    const { start, travel, names } = await runway(page);
    const heading = page
      .getByRole("region", { name: "استكشف النكهات" })
      .locator(".flavor-feature")
      .getByRole("heading");
    await scrollTo(page, start + travel / (names.length - 1));
    await expect(heading).toHaveText(names[1]);
    const choose = (await page
      .locator(".flavor-feature .flavor-choose")
      .boundingBox())!;
    const bar = (await page.locator(".mobile-order-bar").boundingBox())!;
    expect(choose.y + choose.height).toBeLessThanOrEqual(bar.y);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
  });
});
