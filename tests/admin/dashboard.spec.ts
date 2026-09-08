import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { categories, items, locations } from "../../src/data";

const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
async function backend(page: Page, admin = true) {
  const data: Record<string, any[]> = {
    categories: categories
      .filter((c) => c.id !== "all")
      .map((c, i) => ({ ...c, available: true, sort_order: i })),
    menu_items: items.map((c, i) => ({ ...c, available: true, sort_order: i })),
    locations: locations.map((c, i) => ({
      ...c,
      available: true,
      sort_order: i,
    })),
  };
  const user = {
    id: "00000000-0000-0000-0000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "admin@example.com",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  await page.route("https://test-project.supabase.co/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname.includes("/auth/v1/token"))
      return route.fulfill({
        json: {
          access_token: "test-access-token",
          refresh_token: "test-refresh-token",
          expires_in: 3600,
          token_type: "bearer",
          user,
        },
      });
    if (url.pathname.includes("/auth/v1/logout"))
      return route.fulfill({ status: 204 });
    if (url.pathname.includes("/auth/v1/user"))
      return route.fulfill({ json: user });
    // Storage: serve uploaded photos back, and accept new ones.
    if (url.pathname.includes("/storage/v1/object/public/"))
      return route.fulfill({ contentType: "image/png", body: PIXEL });
    if (url.pathname.startsWith("/storage/v1/object/"))
      return route.fulfill({ json: { Key: url.pathname } });
    const table = url.pathname.split("/").at(-1)!;
    if (table === "admin_users")
      return route.fulfill({ json: admin ? { user_id: user.id } : null });
    if (!(table in data)) return route.fulfill({ status: 404 });
    const id = url.searchParams.get("id")?.replace("eq.", "");
    let result: any = data[table];
    if (req.method() === "POST") {
      const row = req.postDataJSON();
      data[table].push(row);
      result = { id: row.id };
    }
    if (req.method() === "PATCH") {
      const index = data[table].findIndex((row) => row.id === id);
      data[table][index] = { ...data[table][index], ...req.postDataJSON() };
      result = { id };
    }
    if (req.method() === "DELETE") {
      data[table] = data[table].filter((row) => row.id !== id);
      result = { id };
    }
    return route.fulfill({ json: result });
  });
  return data;
}
async function login(page: Page) {
  await page.goto("/admin");
  await page.getByLabel("Adresse e-mail").fill("admin@example.com");
  await page.getByLabel("Mot de passe", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Tout commence par le goût." }),
  ).toBeVisible();
}
// The editor and delete dialogs are modal, so the dashboard behind them is inert.
// Saving only closes the dialog once the write and the content refresh resolve;
// touching the background before that silently does nothing (a typed search box
// gets reset by the next render). Every save/confirm must wait for the close.
async function save(page: Page) {
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function confirmDelete(page: Page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Supprimer", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function fillTranslations(page: Page, label: string, value: string) {
  for (const lang of ["Français", "English", "العربية"])
    await page
      .getByRole("dialog")
      .getByLabel(`${label} · ${lang}`, { exact: true })
      .fill(value);
}
test("admin sign-in, category/menu/location CRUD, filtering and website sync", async ({
  page,
}) => {
  const data = await backend(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await page.screenshot({
    path: "admin-test-results/admin-overview.png",
    fullPage: true,
  });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Catégories/ })
    .click();
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await fillTranslations(page, "Nom", "Specials");
  await save(page);
  await expect(
    page.getByRole("row").filter({ hasText: "Specials" }),
  ).toHaveCount(1);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Carte & plats/ })
    .click();
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await fillTranslations(page, "Nom", "Test shawarma");
  await fillTranslations(page, "Description", "Fresh and delicious");
  await page
    .getByRole("dialog")
    .getByRole("combobox", { name: "Catégorie", exact: true })
    .click();
  await page
    .getByRole("listbox", { name: "Catégorie" })
    .getByRole("option", { name: "Specials", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Prix (DH)", { exact: true })
    .fill("42");
  await save(page);
  await page.getByLabel("Rechercher…").fill("Test shawarma");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Modifier Test shawarma", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Prix (DH)", { exact: true })
    .fill("49");
  await save(page);
  await expect(page.locator("tbody tr")).toContainText("49");
  await page.goto("/");
  await page.getByRole("searchbox").fill("Test shawarma");
  await expect(page.locator(".food-card")).toContainText("49");
  await page.goto("/admin/items");
  await page.getByLabel("Rechercher…").fill("Test shawarma");
  await page
    .getByRole("button", { name: "Supprimer Test shawarma", exact: true })
    .click();
  await confirmDelete(page);
  await expect(page.locator("tbody tr")).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Catégories/ })
    .click();
  await page
    .getByRole("button", { name: "Modifier Specials", exact: true })
    .click();
  await fillTranslations(page, "Nom", "Updated specials");
  await save(page);
  await page
    .getByRole("button", { name: "Supprimer Updated specials", exact: true })
    .click();
  await confirmDelete(page);
  await expect(
    page.getByRole("row").filter({ hasText: "Updated specials" }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Restaurants/ })
    .click();
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await fillTranslations(page, "Nom", "Test restaurant");
  await fillTranslations(page, "Sous-titre du quartier", "Casablanca");
  await fillTranslations(page, "Adresse", "Test address");
  await page
    .getByLabel("Lien Google Maps", { exact: true })
    .fill("https://maps.google.com");
  await save(page);
  await page
    .getByRole("button", { name: "Modifier Test restaurant", exact: true })
    .click();
  await fillTranslations(page, "Adresse", "Updated address");
  await save(page);
  await expect(
    page.getByRole("row").filter({ hasText: "Test restaurant" }),
  ).toContainText("Updated address");
  await page
    .getByRole("button", { name: "Supprimer Test restaurant", exact: true })
    .click();
  await confirmDelete(page);
  await expect(
    page.getByRole("row").filter({ hasText: "Test restaurant" }),
  ).toHaveCount(0);
  expect(data.locations).toHaveLength(2);
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: "Déconnexion", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Se connecter", exact: true }),
  ).toBeVisible();
});
test("non-admin users cannot open dashboard", async ({ page }) => {
  await backend(page, false);
  await page.goto("/admin");
  await page.getByLabel("Adresse e-mail").fill("admin@example.com");
  await page.getByLabel("Mot de passe", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Ce compte n’a pas accès à l’administration.",
  );
  await expect(page.locator(".admin-sidebar")).toHaveCount(0);
});
test("login failures and failed saves are recoverable", async ({ page }) => {
  await backend(page);
  await page.route("**/auth/v1/token*", (route) =>
    route.fulfill({
      status: 400,
      json: {
        error: "invalid_grant",
        error_description: "Invalid login credentials",
      },
    }),
  );
  await page.goto("/admin");
  await page.getByLabel("Adresse e-mail").fill("admin@example.com");
  await page.getByLabel("Mot de passe", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Connexion impossible");
  await expect(
    page.getByRole("button", { name: "Se connecter", exact: true }),
  ).toBeEnabled();
  await page.unroute("**/auth/v1/token*");
  await login(page);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Catégories/ })
    .click();
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await fillTranslations(page, "Nom", "Preserved draft");
  await page.route("**/rest/v1/categories*", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ status: 403, json: { message: "denied" } })
      : route.fallback(),
  );
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Nom · Français", { exact: true })).toHaveValue(
    "Preserved draft",
  );
  await page.unroute("**/rest/v1/categories*");
  await save(page);
  await expect(
    page.getByRole("row").filter({ hasText: "Preserved draft" }),
  ).toHaveCount(1);
});
test("open website refreshes prices and removes hidden content", async ({
  page,
}) => {
  const data = await backend(page);
  await page.goto("/");
  await page.getByRole("searchbox").fill("citronnade");
  await expect(page.locator(".food-card")).toContainText("13");
  data.menu_items.find((i) => i.id === "lemonade").price = 17;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator(".food-card")).toContainText("17");
  data.categories.find((c) => c.id === "desserts").available = false;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator(".food-card")).toHaveCount(0);
  await expect(page.locator(".category-tabs")).not.toContainText(
    "Douceurs & boissons",
  );
  data.locations[0].available = false;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator(".location-card")).toHaveCount(1);
  await page.route("**/rest/v1/menu_items*", (route) =>
    route.fulfill({ status: 403, json: { message: "Unavailable" } }),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("alert")).toContainText(
    "Impossible de charger la carte",
  );
});
test("RTL, mobile layout, category protection, variants and hidden content", async ({
  page,
}) => {
  const data = await backend(page);
  await login(page);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Catégories/ })
    .click();
  await page
    .getByRole("button", { name: "Supprimer Shawarmas", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Supprimer", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Carte & plats/ })
    .click();
  await page
    .getByRole("button", { name: "Modifier Family Box", exact: true })
    .click();
  await expect(page.locator(".admin-variant")).toHaveCount(4);
  await page.getByLabel("Prix (DH) 1", { exact: true }).fill("250");
  await save(page);
  expect(data.menu_items.find((i) => i.id === "family").variants[0].price).toBe(
    250,
  );
  await page.getByRole("button", { name: "Langue", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "العربية" }).click();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const layout = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      nodes: [
        ".admin-shell",
        ".admin-sidebar",
        ".admin-topbar",
        ".admin-body",
        ".admin-main",
        ".admin-heading",
        ".admin-filters",
        ".admin-table-wrap",
        ".admin-bottom",
      ].map((s) => {
        const el = document.querySelector(s)!;
        const r = el.getBoundingClientRect();
        return { s, x: r.x, w: r.width, scroll: el.scrollWidth };
      }),
    }));
    expect(layout.scroll, JSON.stringify(layout)).toBeLessThanOrEqual(
      width + 1,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "admin-test-results/admin-ar-mobile.png",
    fullPage: true,
  });
  data.menu_items = [];
  data.categories = [];
  data.locations = [];
  await page.goto("/");
  await expect(page.locator(".food-card")).toHaveCount(0);
  await expect(page.locator(".family-section")).toHaveCount(0);
  await expect(page.locator(".location-card")).toHaveCount(0);
});
test("photo upload fills the image URL, rejects bad files and saves", async ({
  page,
}) => {
  const data = await backend(page);
  const uploads: string[] = [];
  page.on("request", (r) => {
    const path = new URL(r.url()).pathname;
    if (r.method() === "POST" && path.startsWith("/storage/v1/object/"))
      uploads.push(path);
  });
  await login(page);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Carte & plats/ })
    .click();
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const file = dialog.locator('input[type="file"]');
  const url = dialog.getByLabel(/URL de l’image/);
  // Uploading is reachable from the default preset, without picking "custom"
  // first; the URL field only joins once there is a URL to show.
  await expect(file).toBeAttached();
  await expect(url).toHaveCount(0);

  // Type and size are refused before any request leaves the browser.
  await file.setInputFiles({
    name: "menu.pdf",
    mimeType: "application/pdf",
    buffer: PIXEL,
  });
  await expect(dialog.getByText(/Format non pris en charge/)).toBeVisible();
  await file.setInputFiles({
    name: "huge.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  });
  await expect(dialog.getByText(/Image trop lourde/)).toBeVisible();
  expect(uploads).toEqual([]);

  await file.setInputFiles({
    name: "dish.png",
    mimeType: "image/png",
    buffer: PIXEL,
  });
  await expect(dialog.getByText("Photo téléversée.")).toBeVisible();
  expect(uploads).toHaveLength(1);
  // A successful upload is itself the switch away from the preset.
  await expect(
    dialog.getByRole("combobox", { name: "Photo", exact: true }),
  ).toContainText("Image personnalisée");
  const value = await url.inputValue();
  // The database only accepts https:// or /assets/ images.
  expect(value).toMatch(
    /^https:\/\/test-project\.supabase\.co\/storage\/v1\/object\/public\/menu-images\/items\/[0-9a-f-]{36}\.png$/,
  );

  await fillTranslations(page, "Nom", "Shawarma photo");
  await fillTranslations(page, "Description", "Avec photo maison");
  await dialog.getByLabel("Prix (DH)", { exact: true }).fill("45");
  await save(page);
  expect(data.menu_items.at(-1).image).toBe(value);
  await expect(
    page.getByRole("row").filter({ hasText: "Shawarma photo" }),
  ).toHaveCount(1);
});
