import { test, expect } from "@playwright/test";

test("menu search, categories, prices and product options work", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "SHAWARMA",
  );
  await page.getByRole("searchbox").fill("citronnade");
  await expect(page.locator(".food-card")).toHaveCount(1);
  await expect(page.locator(".food-card")).toContainText("13");
  await page.getByRole("searchbox").fill("not-a-dish");
  await expect(page.getByText("Aucun plat trouvé.")).toBeVisible();
  await page.getByRole("button", { name: "Effacer les filtres" }).click();
  await page
    .locator(".category-tabs")
    .getByRole("button", { name: "Shawarmas", exact: true })
    .click();
  await expect(page.locator(".food-card")).toHaveCount(5);
  await page.getByRole("switch", { name: "En menu" }).click();
  await expect(
    page.locator(".food-card").first().locator(".food-bottom"),
  ).toContainText("46");
  await page.locator(".food-card").first().locator(".round-button").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".product-price")).toContainText("46");
  await dialog.getByRole("switch").click();
  await expect(dialog.locator(".product-price")).toContainText("29");
  await expect(
    dialog.getByRole("link", { name: "Commander sur Glovo" }),
  ).toHaveAttribute(
    "href",
    /glovoapp.com\/fr\/ma\/casablanca\/stores\/shawarma-lma3louma-cas/,
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page
    .locator(".category-tabs")
    .getByRole("button", { name: "Family Box", exact: true })
    .click();
  await page.locator(".food-card .round-button").click();
  await page.getByRole("combobox", { name: "Votre version" }).click();
  await page
    .getByRole("listbox", { name: "Votre version" })
    .getByRole("option")
    .nth(3)
    .click();
  await expect(page.locator(".product-price")).toContainText("289");
});

test("all languages persist and Arabic uses RTL", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Langue", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("searchbox")).toHaveAttribute(
    "placeholder",
    "Search for a dish, a flavour…",
  );
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("button", { name: "Language", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "العربية" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "الشاورما",
  );
  await page.getByRole("searchbox").fill("الشمندر");
  await expect(page.locator(".food-card")).toHaveCount(1);
  await page.getByRole("searchbox").fill("");
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(async () => {
      await document.fonts.ready;
      document.documentElement.dataset.motion = "off";
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Arabic overflow at ${width}px`,
    ).toBeTruthy();
  }
  await page.screenshot({ path: "test-results/arabic-tablet.png" });
});

test("custom select and date picker replace native browser chrome", async ({
  page,
}) => {
  await page.goto("/");

  // Sort is a listbox the site paints itself, not a native <select>.
  await expect(page.locator("select")).toHaveCount(0);
  const sort = page.getByRole("combobox", { name: "Trier le menu" });
  await expect(sort).toHaveAttribute("aria-expanded", "false");
  await sort.click();
  const list = page.getByRole("listbox", { name: "Trier le menu" });
  await expect(list.getByRole("option")).toHaveCount(3);
  await list.getByRole("option", { name: "Prix croissant" }).click();
  await expect(list).toHaveCount(0);
  await expect(sort).toContainText("Prix croissant");

  // Keyboard: the trigger opens the list, arrows move, Enter commits.
  await sort.press("ArrowDown");
  await page.getByRole("option", { name: "Prix décroissant" }).press("Enter");
  await expect(sort).toContainText("Prix décroissant");
  // Escape closes without changing the value and restores focus.
  await sort.press("ArrowDown");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(sort).toBeFocused();
  await expect(sort).toContainText("Prix décroissant");

  // The calendar is rendered by the app, in the app's language.
  await page
    .getByRole("button", { name: "Préparer ma visite" })
    .first()
    .click();
  const modal = page.getByRole("dialog").first();
  await expect(
    modal.locator('input[type="date"], input[type="time"]'),
  ).toHaveCount(0);
  await modal.locator(".picker-trigger").click();
  const calendar = page.getByRole("dialog", { name: "Date de visite" });
  await expect(calendar).toContainText(
    new Intl.DateTimeFormat("fr-MA", { month: "long" }).format(new Date()),
  );
  // Days before today cannot be picked.
  const past = calendar.locator(".picker-grid button:disabled");
  if (await past.count()) await expect(past.first()).toBeDisabled();
  // Picking a day closes the calendar and updates the trigger.
  const pick = calendar.locator(".picker-grid button:not(:disabled)").nth(1);
  const label = await pick.textContent();
  await pick.click();
  await expect(calendar).toHaveCount(0);
  await expect(modal.locator(".picker-trigger")).toContainText(label!.trim());
});

test("mobile navigation, Glovo handoff and calendar reminder", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Navigation", exact: true }).click();
  await page
    .locator("#mobile-nav")
    .getByRole("link", { name: "Nos adresses" })
    .click();
  await expect(page.locator("#mobile-nav")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Préparer ma visite" })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Ceci n’est pas une réservation",
  );
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Ajouter à mon calendrier" }).click();
  expect((await download).suggestedFilename()).toMatch(/lma3louma-.*\.ics/);
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "Rappel téléchargé",
  );
  await page.getByRole("button", { name: "Fermer", exact: true }).click();
  await page.locator(".mobile-order-bar").getByRole("button").click();
  await expect(
    page.getByRole("dialog").getByRole("link", { name: "Continuer sur Glovo" }),
  ).toHaveAttribute("href", /glovoapp.com/);
  await page.keyboard.press("Escape");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});

test("desktop and mobile layouts load without broken assets or runtime errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.evaluate(async () => {
      await document.fonts.ready;
      document.documentElement.dataset.motion = "off";
      document
        .querySelectorAll(".reveal")
        .forEach((e) => e.classList.add("is-visible"));
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `overflow at ${width}px`,
    ).toBeTruthy();
    // Lazy images below the fold never finish loading in a headless run, so
    // `complete` alone silently excuses exactly the ones least likely to be
    // noticed by eye. Force every image to load, then name what failed.
    expect(
      await page.locator("img").evaluateAll(async (imgs) => {
        await Promise.allSettled(
          imgs.map((i) => {
            (i as HTMLImageElement).loading = "eager";
            return (i as HTMLImageElement).decode();
          }),
        );
        return imgs
          .filter((i) => !(i as HTMLImageElement).naturalWidth)
          .map((i) => (i as HTMLImageElement).getAttribute("src"));
      }),
    ).toEqual([]);
    if (width === 1440 || width === 390)
      await page.screenshot({
        path: `test-results/site-${width}.png`,
        fullPage: true,
      });
  }
  expect(errors).toEqual([]);
});
