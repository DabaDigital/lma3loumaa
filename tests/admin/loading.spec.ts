import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { categories, items, locations } from "../../src/data";

function gate() {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { wait, release };
}
async function delayedBackend(page: Page) {
  const content = gate(),
    membership = gate();
  const user = {
    id: "00000000-0000-0000-0000-000000000001",
    email: "admin@example.com",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-09-01T12:00:00Z",
  };
  const data: Record<string, unknown[]> = {
    categories: categories
      .filter((c) => c.id !== "all")
      .map((c, sort_order) => ({ ...c, available: true, sort_order })),
    menu_items: items.map((c, sort_order) => ({
      ...c,
      available: true,
      sort_order,
    })),
    locations: locations.map((c, sort_order) => ({
      ...c,
      available: true,
      sort_order,
    })),
    reviews: [],
  };
  await page.route("https://test-project.supabase.co/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes("/auth/v1/token"))
      return route.fulfill({
        json: {
          access_token: "test-token",
          refresh_token: "test-refresh",
          expires_in: 3600,
          token_type: "bearer",
          user,
        },
      });
    if (url.pathname.includes("/auth/v1/user"))
      return route.fulfill({ json: user });
    const table = url.pathname.split("/").at(-1)!;
    if (table === "admin_users") {
      await membership.wait;
      return route.fulfill({ json: { user_id: user.id } });
    }
    if (table in data) {
      await content.wait;
      return route.fulfill({ json: data[table] });
    }
    return route.fulfill({ json: [] });
  });
  return { content, membership };
}

test("public skeletons replace loading content without showing false empty states", async ({
  page,
}) => {
  const backend = await delayedBackend(page);
  await page.goto("/");
  await expect(page.locator("#menu .skeleton-menu")).toBeVisible();
  await expect(page.locator("#locations .skeleton-locations")).toBeAttached();
  await expect(page.locator("#reviews .skeleton-reviews")).toBeAttached();
  await expect(page.locator("#menu .empty-state")).toHaveCount(0);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".skeleton")
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .locator("#menu")
    .screenshot({ path: "test-results/menu-skeleton.png" });
  backend.content.release();
  await expect(page.locator("#menu .food-card")).toHaveCount(8);
  await expect(page.locator(".skeleton-layout")).toHaveCount(0);
  await expect(page.locator(".location-card")).toHaveCount(2);
});

test("admin authorization and every data section show skeletons until ready", async ({
  page,
}) => {
  const backend = await delayedBackend(page);
  await page.goto("/admin");
  await page.getByLabel("Adresse e-mail").fill("admin@example.com");
  await page.getByLabel("Mot de passe", { exact: true }).fill("password");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page.locator(".skeleton-login")).toBeVisible();
  await expect(page.locator("#admin-main")).toHaveCount(0);
  backend.membership.release();
  await expect(page.locator(".skeleton-overview")).toBeVisible();
  for (const section of ["Carte & plats", "Catégories", "Restaurants"]) {
    await page
      .getByRole("navigation")
      .getByRole("button", { name: section })
      .click();
    await expect(page.locator(".skeleton-table[role=status]")).toBeVisible();
  }
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Avis clients" })
    .click();
  await expect(page.locator(".skeleton-admin-reviews")).toBeVisible();
  await page
    .locator("#admin-main")
    .screenshot({ path: "test-results/admin-skeleton.png" });
  backend.content.release();
  await expect(page.locator(".skeleton-layout")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Aucun avis dans cette sélection." }),
  ).toBeVisible();
});

test("image skeletons stop on success and error", async ({ page }) => {
  const backend = await delayedBackend(page);
  backend.content.release();
  const photo = gate();
  await page.route(
    "**/assets/optimized/shawarma-normal-*.webp",
    async (route) => {
      await photo.wait;
      await route.abort();
    },
  );
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const image = page.locator(".hero-food img");
  await expect(image).toHaveClass(/skeleton-image/);
  photo.release();
  await expect(image).not.toHaveClass(/skeleton-image/);
  const logo = page.locator(".brand img").first();
  await expect(logo).toHaveJSProperty("complete", true);
  await expect(logo).not.toHaveClass(/skeleton-image/);
});

test("returning to the tab keeps the signed-in user's public content visible", async ({
  page,
}) => {
  const backend = await delayedBackend(page);
  backend.content.release();
  backend.membership.release();
  await page.goto("/admin");
  await page.getByLabel("Adresse e-mail").fill("admin@example.com");
  await page.getByLabel("Mot de passe", { exact: true }).fill("password");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page.locator("#admin-main")).toBeVisible();
  await page.goto("/");
  await expect(page.locator(".food-card")).toHaveCount(8);
  await expect(page.locator(".skeleton-layout")).toHaveCount(0);

  const refresh = gate();
  let requests = 0;
  await page.route("**/rest/v1/**", async (route) => {
    requests++;
    await refresh.wait;
    await route.fallback();
  });
  try {
    // Supabase re-emits SIGNED_IN for the current session on visibility regain.
    await page.evaluate(() => {
      window.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });
    await expect.poll(() => requests).toBeGreaterThan(0);
    await expect(page.locator(".food-card")).toHaveCount(8);
    await expect(page.locator(".skeleton-layout")).toHaveCount(0);
    await page.getByRole("searchbox").fill("citronnade");
    await expect(page.locator(".food-card")).toHaveCount(1);
  } finally {
    refresh.release();
  }
});

test("background authorization preserves the admin draft and still enforces revoked access", async ({
  page,
}) => {
  const backend = await delayedBackend(page);
  backend.content.release();
  backend.membership.release();
  await page.goto("/admin");
  await page.getByLabel("Adresse e-mail").fill("admin@example.com");
  await page.getByLabel("Mot de passe", { exact: true }).fill("password");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Carte & plats/ })
    .click();
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  const name = page
    .getByRole("dialog")
    .getByLabel("Nom · Français", { exact: true });
  await name.fill("Unsaved draft");

  const authorization = gate();
  let checked = false;
  await page.route("**/rest/v1/admin_users?**", async (route) => {
    checked = true;
    await authorization.wait;
    await route.fulfill({ json: null });
  });
  try {
    await page.evaluate(() =>
      window.dispatchEvent(new Event("visibilitychange")),
    );
    await expect.poll(() => checked).toBe(true);
    await expect(name).toHaveValue("Unsaved draft");
    await expect(page.locator("#admin-main")).toBeVisible();
  } finally {
    authorization.release();
  }
  await expect(page.locator("#admin-main")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
