import { test, expect } from "@playwright/test";

test("menu search, categories, prices and product options work", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "LMA3LOUMA",
  );
  await page.locator(".menu-showcase-catalog-trigger").click();
  await expect(page).toHaveURL(/\/menu$/);
  await page.getByRole("searchbox").fill("citronnade");
  await expect(page.locator(".food-card")).toHaveCount(1);
  await expect(page.locator(".food-card")).toContainText("13");
  await page.getByRole("searchbox").fill("not-a-dish");
  await expect(page.getByText("Aucun plat trouvé.")).toBeVisible();
  await page
    .locator(".empty-state")
    .getByRole("button", { name: "Voir tout le menu" })
    .click();
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

test("flavor showcase navigates dishes, meal prices and categories", async ({
  page,
}) => {
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Découvrez nos saveurs" });
  const feature = carousel.locator(".flavor-feature");
  const thumbnails = page.getByRole("group", {
    name: "Choisissez votre saveur",
  });
  const categories = page.locator(".menu-showcase-categories");
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  await expect(feature.getByRole("heading")).toHaveText("Lma3louma");
  await expect(feature.locator(".flavor-price-badge strong")).toHaveText("29");

  // Previous wraps to the last flavor; next returns to the signature dish.
  await carousel
    .getByRole("button", { name: "Saveur précédente", exact: true })
    .click();
  await expect(feature.getByRole("heading")).toHaveText("Lma3louma Mexicaine");
  await carousel
    .getByRole("button", { name: "Saveur suivante", exact: true })
    .click();
  await expect(feature.getByRole("heading")).toHaveText("Lma3louma");

  const cheddar = thumbnails.getByRole("button", {
    name: /^Lma3louma Cheddar /,
  });
  await cheddar.click();
  await expect(cheddar).toHaveAttribute("aria-pressed", "true");
  await expect(feature.getByRole("heading")).toHaveText("Lma3louma Cheddar");
  await expect(feature.locator(".flavor-price-badge strong")).toHaveText("34");
  await carousel.getByRole("button", { name: "En menu", exact: true }).click();
  await expect(feature.locator(".flavor-price-badge strong")).toHaveText("51");
  await expect(cheddar).toContainText("51");
  await feature.getByRole("button", { name: "Je la choisis" }).click();
  await expect(
    page.getByRole("dialog", { name: "Lma3louma Cheddar", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").locator(".product-price"),
  ).toContainText("51");
  await page.keyboard.press("Escape");

  await categories.getByRole("button", { name: "Mezzés", exact: true }).click();
  await expect(feature.getByRole("heading")).toHaveText("Houmous");
  // Dishes without a meal upgrade retain their own price.
  await expect(feature.locator(".flavor-price-badge strong")).toHaveText("20");
  await page
    .locator(".mezze-strip")
    .getByRole("button", { name: "Je la choisis: Baba Ghanoush", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Baba Ghanoush", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  const more = categories.locator(".menu-showcase-more");
  await more.locator("summary").click();
  await more
    .getByRole("button", { name: "Super shawarmas", exact: true })
    .click();
  await expect(more).not.toHaveAttribute("open", "");
  await expect(more.locator("summary")).toContainText("Super shawarmas");
  await expect(feature.getByRole("heading")).toHaveText("Lma3louma Super");
  await expect(carousel.locator(".flavor-arrow")).toHaveCount(0);

  // With two dishes, previous and next are the same one: it shows once.
  await more.locator("summary").click();
  await more.getByRole("button", { name: "À côté", exact: true }).click();
  await expect(carousel.locator(".flavor-arrow")).toHaveCount(2);
  await expect(carousel.locator(".flavor-neighbor")).toHaveCount(1);

  // The full menu opens as its own page, on every category.
  const catalogTrigger = page.locator(".menu-showcase-catalog-trigger");
  await catalogTrigger.click();
  await expect(page).toHaveURL(/\/menu$/);
  await expect(page.locator(".menu-showcase")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 1, name: "Le menu" }),
  ).toBeFocused();
  await page.getByRole("searchbox").fill("citronnade");
  await expect(page.locator(".food-card")).toHaveCount(1);
  await page
    .locator(".menu-catalog-heading")
    .getByRole("link", { name: "Revenir aux saveurs" })
    .click();
  await expect(page).toHaveURL(/\/#menu$/);
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  await expect(catalogTrigger).toBeInViewport();
  await catalogTrigger.click();
  await expect(page.getByRole("searchbox")).toHaveValue("");
  await expect(
    page
      .locator(".food-card")
      .getByRole("heading", { name: "Lma3louma", exact: true }),
  ).toBeVisible();
});

test("the full menu is a page of its own", async ({ page }) => {
  await page.goto("/");
  const nav = page.locator(".desktop-nav");
  const menuLink = nav.getByRole("link", { name: "Le menu" });

  // Leaving the home page halfway down and coming back returns to that spot,
  // once fonts and photos have settled its layout.
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  const leftAt = () =>
    page.evaluate(() => (window as unknown as { leftAt?: number }).leftAt);
  await page.evaluate(() => {
    const flags = window as unknown as { leftAt?: number };
    scrollTo({ top: 1500, behavior: "instant" });
    // Playwright may scroll before clicking, so note where the click happened.
    document.addEventListener("click", () => (flags.leftAt = scrollY), {
      capture: true,
      once: true,
    });
  });
  await menuLink.click();
  const homeScroll = (await leftAt())!;
  expect(homeScroll).toBeGreaterThan(0);
  await expect(page).toHaveURL(/\/menu$/);
  await expect(page).toHaveTitle(/^Le menu — Shawarma Lma3louma$/);
  await expect(menuLink).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".hero")).toHaveCount(0);
  expect(await page.evaluate(() => scrollY)).toBe(0);

  // The chosen tab is kept in the address, so it can be linked to.
  const tabs = page.locator(".category-tabs");
  const mezze = tabs.getByRole("button", { name: "Mezzés", exact: true });
  await mezze.click();
  await expect(page).toHaveURL(/\/menu\?category=mezze$/);
  const mezzeCount = await page.locator(".food-card").count();
  expect(mezzeCount).toBeGreaterThan(0);

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".hero")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => scrollY))
    .toBeCloseTo(homeScroll, -1);
  // Sections below still fade in after the page is swapped back.
  await page.locator(".location-card").first().scrollIntoViewIfNeeded();
  await expect(page.locator(".location-card").first()).toHaveClass(
    /is-visible/,
  );
  await page.goForward();
  await expect(mezze).toHaveAttribute("aria-pressed", "true");
  // Still the same document: the flag set before the first click survived.
  expect(await leftAt()).toBe(homeScroll);
  await page.reload();
  await expect(mezze).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".food-card")).toHaveCount(mezzeCount);

  // Footer menu links open the page on their category.
  await page.goto("/");
  await page
    .locator("footer .footer-links")
    .first()
    .getByRole("link", { name: "Shawarmas", exact: true })
    .click();
  await expect(page).toHaveURL(/\/menu\?category=shawarma$/);
  await expect(
    tabs.getByRole("button", { name: "Shawarmas", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => scrollY)).toBe(0);

  // From the menu page, other header links lead back into the home page.
  await nav.getByRole("link", { name: "Nos adresses" }).click();
  await expect(page).toHaveURL(/\/#locations$/);
  await expect(page.locator("#locations")).toBeInViewport();
});

test("showcase headline never collides with the side dishes", async ({
  page,
}) => {
  await page.goto("/");
  const check = async (language: string) => {
    // End at 1440px, where the header's language menu is visible.
    for (const width of [1000, 1180, 1900, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => document.fonts.ready);
      const collisions = await page.evaluate(() => {
        const boxes = (selector: string) =>
          [...document.querySelectorAll(selector)].map((element) =>
            element.getBoundingClientRect(),
          );
        const intro = boxes(".menu-showcase-intro h2, .menu-showcase-intro p");
        return boxes(".flavor-neighbor, .flavor-arrow").filter((box) =>
          intro.some(
            (text) =>
              text.left < box.right &&
              box.left < text.right &&
              text.top < box.bottom &&
              box.top < text.bottom,
          ),
        ).length;
      });
      expect(collisions, `${language} at ${width}px`).toBe(0);
    }
  };
  await check("French");
  await page.getByRole("button", { name: "Langue", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "English" }).click();
  await check("English");
  await page.getByRole("button", { name: "Language", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "العربية" }).click();
  await check("Arabic");
});

test("Arabic showcase keyboard navigation and more categories fit a narrow phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Langue", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "العربية" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  const carousel = page.getByRole("region", { name: "استكشف النكهات" });
  const heading = carousel.locator(".flavor-feature").getByRole("heading");
  await carousel.focus();
  await carousel.press("ArrowLeft");
  await expect(heading).toHaveText("المعلومة شيدر");
  await carousel.press("ArrowRight");
  await expect(heading).toHaveText("المعلومة");
  await carousel.press("ArrowRight");
  await expect(heading).toHaveText("المعلومة مكسيكية");

  const more = page.locator(".menu-showcase-more");
  await more.locator("summary").click();
  await expect(
    more.getByRole("button", { name: "حلويات ومشروبات", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Arabic showcase and open category menu fit 320px",
  ).toBeTruthy();
  await more
    .getByRole("button", { name: "حلويات ومشروبات", exact: true })
    .click();
  await expect(heading).toHaveText("مشروب");
  await expect(more).not.toHaveAttribute("open", "");
  await more.locator("summary").click();
  await more.locator("summary").press("Escape");
  await expect(more).not.toHaveAttribute("open", "");
  await expect(more.locator("summary")).toBeFocused();
});

test("all languages persist and Arabic uses RTL", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Langue", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.locator(".menu-showcase-catalog-trigger").click();
  await expect(page.getByRole("searchbox")).toHaveAttribute(
    "placeholder",
    "Search for a dish, a flavour…",
  );
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("button", { name: "Language", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "العربية" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "لمعلومة",
  );
  await page.locator(".menu-showcase-catalog-trigger").click();
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

test.describe("first visit", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test("opens in Arabic; French and English use Titan One", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "لمعلومة",
    );
    await page.getByRole("button", { name: "اللغة", exact: true }).click();
    await page.getByRole("menuitemradio", { name: "Français" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await page.locator(".menu-showcase-catalog-trigger").click();
    for (const text of [
      page.getByRole("heading", { level: 1 }),
      page.getByRole("searchbox"),
    ])
      await expect(text).toHaveCSS("font-family", /^"?Titan One"?,/);
    const loaded = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].some(
        (face) =>
          face.family.replace(/"/g, "") === "Titan One" &&
          face.status === "loaded",
      );
    });
    expect(loaded, "Titan One font file loaded").toBe(true);
  });
});

test("custom select and date picker replace native browser chrome", async ({
  page,
}) => {
  await page.goto("/");

  // Sort is a listbox the site paints itself, not a native <select>.
  await page.locator(".menu-showcase-catalog-trigger").click();
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
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
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

test("family box shows its contents, the brand line and even spacing", async ({
  page,
}) => {
  await page.goto("/");
  const family = page.locator(".family-section");
  await expect(family).toContainText(
    "Des rolls, des frites, des sauces et une grande boisson à partager.",
  );
  await expect(family.locator(".family-signature")).toContainText(
    "لمعلومة مكتنساااش",
  );
  // The story section repeated the family copy; it and its nav link are gone.
  await expect(page.locator("#story")).toHaveCount(0);
  await expect(page.locator('a[href="/#story"]')).toHaveCount(0);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => {
      document.documentElement.dataset.motion = "off";
      document
        .querySelectorAll(".reveal")
        .forEach((e) => e.classList.add("is-visible"));
    });
    const gaps = await family.evaluate((el) => {
      const box = el.getBoundingClientRect();
      return {
        above: Math.round(
          box.top - el.previousElementSibling!.getBoundingClientRect().bottom,
        ),
        below: Math.round(
          el.nextElementSibling!.getBoundingClientRect().top - box.bottom,
        ),
      };
    });
    expect(gaps.above, `space above at ${width}px`).toBeGreaterThan(0);
    expect(gaps.below, `space below at ${width}px`).toBe(gaps.above);
  }
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
