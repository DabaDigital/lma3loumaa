import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { categories, items, locations } from "../../src/data";

const PHOTO = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const SUCCESS = "Merci ! Votre avis sera publié après validation.";
type Review = {
  id: string;
  title: string;
  description: string;
  rating: number;
  status: "approved" | "pending" | "rejected";
  image_path: string | null;
  created_at: string;
};
function review(overrides: Partial<Review> = {}): Review {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    title: "Délicieux shawarma",
    description: "Une très bonne adresse à partager en famille.",
    rating: 5,
    status: "approved",
    image_path: null,
    created_at: "2026-09-07T10:00:00Z",
    ...overrides,
  };
}
async function backend(page: Page, initial: Review[] = []) {
  const state = {
    reviews: initial,
    inserts: [] as Record<string, unknown>[],
    uploads: [] as string[],
    downloads: [] as string[],
    queries: [] as URL[],
    uploadFails: false,
    insertFails: false,
    leakUnapproved: false,
  };
  const content: Record<string, unknown[]> = {
    categories: categories
      .filter((entry) => entry.id !== "all")
      .map((entry, sort_order) => ({ ...entry, available: true, sort_order })),
    menu_items: items.map((entry, sort_order) => ({
      ...entry,
      available: true,
      sort_order,
    })),
    locations: locations.map((entry, sort_order) => ({
      ...entry,
      available: true,
      sort_order,
    })),
  };
  await page.route("https://test-project.supabase.co/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.startsWith("/storage/v1/object/")) {
      if (request.method() === "GET") {
        state.downloads.push(url.pathname);
        return route.fulfill({ contentType: "image/png", body: PHOTO });
      }
      if (request.method() === "POST") {
        state.uploads.push(url.pathname);
        return state.uploadFails
          ? route.fulfill({
              status: 503,
              json: {
                statusCode: "503",
                error: "Unavailable",
                message: "Upload failed",
              },
            })
          : route.fulfill({ json: { Key: url.pathname } });
      }
      return route.fulfill({ json: [] });
    }
    if (url.pathname === "/rest/v1/reviews") {
      if (request.method() === "GET") {
        state.queries.push(url);
        return route.fulfill({
          json: state.leakUnapproved
            ? state.reviews
            : state.reviews.filter((entry) => entry.status === "approved"),
        });
      }
      if (request.method() === "POST") {
        const body = request.postDataJSON();
        const row = Array.isArray(body) ? body[0] : body;
        state.inserts.push(row);
        if (state.insertFails)
          return route.fulfill({
            status: 503,
            json: { message: "Save failed" },
          });
        state.reviews.push(review({ ...row, status: "pending" }));
        return route.fulfill({ status: 201, body: "" });
      }
    }
    const table = url.pathname.split("/").at(-1)!;
    if (table in content) return route.fulfill({ json: content[table] });
    return route.fulfill({
      status: 404,
      json: { message: "Unknown endpoint" },
    });
  });
  return state;
}
async function openForm(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Donner mon avis", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Partagez votre expérience", level: 3 }),
  ).toBeVisible();
  return dialog;
}
async function fillReview(page: Page, title = "Un repas formidable") {
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Titre", { exact: true }).fill(title);
  await dialog
    .getByLabel("Votre avis (facultatif)", { exact: true })
    .fill("Le shawarma était excellent et le service très agréable.");
  await dialog.getByRole("radio", { name: "5 étoiles", exact: true }).check();
}

test("review form supports keyboard stars and Arabic on narrow screens", async ({ page }) => {
  await backend(page);
  const dialog = await openForm(page);
  const firstStar = dialog.getByRole("radio", { name: "1 étoile", exact: true });
  await firstStar.focus();
  await firstStar.press("Space");
  await firstStar.press("ArrowRight");
  await expect(dialog.getByRole("radio", { name: "2 étoiles", exact: true })).toBeChecked();
  await dialog.screenshot({ path: "test-results/review-form-desktop.png" });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Langue", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "العربية" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByRole("button", { name: "أضف رأيك", exact: true }).click();
    const form = page.getByRole("dialog");
    await expect(form.getByLabel("العنوان", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await form.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await form.screenshot({ path: `test-results/review-form-ar-${width}.png` });
    await page.keyboard.press("Escape");
  }
});

test("only approved reviews render as plain text, and moderation changes refresh on focus", async ({
  page,
}) => {
  const maliciousTitle = '<img src=x onerror="window.reviewXss=true">';
  const maliciousDescription =
    "<script>window.reviewXss=true</script> Très bon repas !";
  const photoPath = "00000000-0000-4000-8000-000000000001/photo.png";
  const state = await backend(page, [
    review({
      title: maliciousTitle,
      description: maliciousDescription,
      image_path: photoPath,
    }),
    review({
      id: "00000000-0000-4000-8000-000000000002",
      title: "Avis en attente",
      status: "pending",
    }),
    review({
      id: "00000000-0000-4000-8000-000000000003",
      title: "Avis refusé",
      status: "rejected",
    }),
  ]);
  // The UI must fail closed even if an API accidentally returns extra records.
  state.leakUnapproved = true;
  await page.goto("/");
  const section = page.locator("#reviews");
  await expect(
    section.getByText(maliciousTitle, { exact: true }),
  ).toBeVisible();
  await expect(
    section.getByText(maliciousDescription, { exact: true }),
  ).toBeVisible();
  await expect(section).not.toContainText("Avis en attente");
  await expect(section).not.toContainText("Avis refusé");
  expect(
    await page.evaluate(
      () => (window as Window & { reviewXss?: boolean }).reviewXss,
    ),
  ).toBeUndefined();
  expect(state.queries.length).toBeGreaterThan(0);
  expect(
    state.queries.every(
      (url) => url.searchParams.get("status") === "eq.approved",
    ),
  ).toBe(true);
  await expect
    .poll(() => state.downloads)
    .toContain(`/storage/v1/object/review-images/${photoPath}`);
  await expect(section.locator('img[src^="blob:"]')).toBeVisible();

  state.reviews[0].status = "rejected";
  state.reviews[1].status = "approved";
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    section.getByText("Avis en attente", { exact: true }),
  ).toBeVisible();
  await expect(section.getByText(maliciousTitle, { exact: true })).toHaveCount(
    0,
  );
});

test("a guest submits a photo review with a server-moderated status and it stays unpublished", async ({
  page,
}) => {
  const state = await backend(page);
  const dialog = await openForm(page);
  await fillReview(page, "  Mon avis avec photo  ");
  await dialog.getByLabel("Photo (facultatif)", { exact: true }).setInputFiles({
    name: "repas.png",
    mimeType: "image/png",
    buffer: PHOTO,
  });
  await dialog
    .getByRole("button", { name: "Envoyer mon avis", exact: true })
    .click();
  await expect(page.getByText(SUCCESS, { exact: true })).toBeVisible();
  expect(state.uploads).toHaveLength(1);
  expect(state.inserts).toHaveLength(1);
  const row = state.inserts[0];
  expect(row.title).toBe("Mon avis avec photo");
  expect(row.rating).toBe(5);
  expect(row).not.toHaveProperty("status");
  expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(row.image_path).toBe(`${row.id}/photo.png`);
  expect(state.uploads[0]).toBe(
    `/storage/v1/object/review-images/${row.image_path}`,
  );
  await page.reload();
  await expect(page.locator("#reviews")).toBeVisible();
  await expect(page.locator("#reviews")).not.toContainText(
    "Mon avis avec photo",
  );
});

test("rating, trimmed text and photo validation prevent invalid submissions", async ({
  page,
}) => {
  const state = await backend(page);
  const dialog = await openForm(page);
  await dialog.getByLabel("Titre", { exact: true }).fill("Bon repas");
  await dialog
    .getByLabel("Votre avis (facultatif)", { exact: true })
    .fill("Un repas très savoureux.");
  await dialog
    .getByRole("button", { name: "Envoyer mon avis", exact: true })
    .click();
  await expect(dialog).toBeVisible();
  expect(state.inserts).toHaveLength(0);
  await dialog.getByRole("radio", { name: "4 étoiles", exact: true }).check();
  await dialog.getByLabel("Titre", { exact: true }).fill("   ");
  await dialog
    .getByRole("button", { name: "Envoyer mon avis", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  expect(state.inserts).toHaveLength(0);
  await dialog.getByLabel("Titre", { exact: true }).fill("Bon repas");
  await dialog
    .getByLabel("Votre avis (facultatif)", { exact: true })
    .fill("Un repas très savoureux.");
  const file = dialog.getByLabel("Photo (facultatif)", { exact: true });
  await file.setInputFiles({
    name: "review.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg/>"),
  });
  await expect(dialog.getByRole("alert")).toBeVisible();
  await file.setInputFiles({
    name: "huge.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  });
  await expect(dialog.getByRole("alert")).toBeVisible();
  expect(state.uploads).toHaveLength(0);
  expect(state.inserts).toHaveLength(0);

  // Removing the optional photo leaves a valid, recoverable form.
  await file.setInputFiles([]);
  await dialog
    .getByRole("button", { name: "Envoyer mon avis", exact: true })
    .click();
  await expect(page.getByText(SUCCESS, { exact: true })).toBeVisible();
  expect(state.inserts).toHaveLength(1);
  expect(state.inserts[0].image_path).toBeNull();
  expect(state.inserts[0].rating).toBe(4);
});

for (const description of ["", "good"]) {
  test(`only rating and title are required (description: ${description || "empty"})`, async ({ page }) => {
    const state = await backend(page);
    const dialog = await openForm(page);
    await dialog.getByLabel("Titre", { exact: true }).fill("A");
    await dialog.getByRole("radio", { name: "5 étoiles", exact: true }).check();
    const reviewText = dialog.getByLabel("Votre avis (facultatif)", { exact: true });
    await expect(reviewText).not.toHaveAttribute("required", "");
    await reviewText.fill(description);
    await dialog.getByRole("button", { name: "Envoyer mon avis", exact: true }).click();
    await expect(page.getByText(SUCCESS, { exact: true })).toBeVisible();
    expect(state.uploads).toHaveLength(0);
    expect(state.inserts).toHaveLength(1);
    expect(state.inserts[0]).toMatchObject({ title: "A", rating: 5, description, image_path: null });
  });
}

test("failed photo uploads and review writes preserve the draft without claiming success", async ({
  page,
}) => {
  const state = await backend(page);
  state.uploadFails = true;
  const dialog = await openForm(page);
  await fillReview(page, "Un avis à réessayer");
  await dialog
    .getByLabel("Photo (facultatif)", { exact: true })
    .setInputFiles({ name: "repas.png", mimeType: "image/png", buffer: PHOTO });
  const send = dialog.getByRole("button", {
    name: "Envoyer mon avis",
    exact: true,
  });
  await send.click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(send).toBeEnabled();
  await expect(page.getByText(SUCCESS, { exact: true })).toHaveCount(0);
  await expect(dialog.getByLabel("Titre", { exact: true })).toHaveValue(
    "Un avis à réessayer",
  );
  expect(state.inserts).toHaveLength(0);

  state.uploadFails = false;
  state.insertFails = true;
  await send.click();
  await expect.poll(() => state.inserts.length).toBe(1);
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(send).toBeEnabled();
  await expect(page.getByText(SUCCESS, { exact: true })).toHaveCount(0);
  await expect(dialog.getByLabel("Titre", { exact: true })).toHaveValue(
    "Un avis à réessayer",
  );

  state.insertFails = false;
  await send.click();
  await expect(page.getByText(SUCCESS, { exact: true })).toBeVisible();
  expect(state.inserts).toHaveLength(2);
  expect(state.reviews).toHaveLength(1);
});
