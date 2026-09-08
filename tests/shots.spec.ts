import { test } from "@playwright/test";

test("menu shots", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1150 });
  await page.goto("/");
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.documentElement.dataset.motion = "off";
    document.querySelectorAll(".reveal").forEach((e) => e.classList.add("is-visible"));
  });
  await page.locator(".category-tabs").scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await page.screenshot({ path: "test-results/menu-all.png" });

  await page.locator(".category-tabs").getByRole("button", { name: "À côté", exact: true }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/menu-extras.png" });
});
