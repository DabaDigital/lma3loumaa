import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { categories, items, locations } from "../../src/data";
import { mockCaptcha } from "./review-protection-mock";

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

const detailRank = (entry: Review) =>
  (entry.image_path ? 2 : 0) + (entry.description ? 1 : 0);
/** A small PostgREST: status/rating filters, ordering, paging and counts. */
function respond(
  url: URL,
  method: string,
  state: {
    reviews: Review[];
    leakUnapproved: boolean;
    detailRankMissing: boolean;
  },
) {
  const status = url.searchParams.get("status");
  const rating = url.searchParams.get("rating");
  let rows = state.reviews.filter(
    (entry) =>
      (!status ||
        status === `eq.${entry.status}` ||
        (state.leakUnapproved && method === "GET")) &&
      (!rating || rating === `eq.${entry.rating}`),
  );
  const order = (url.searchParams.get("order") ?? "")
    .split(",")
    .filter(Boolean)
    .map((part) => part.split("."));
  if (state.detailRankMissing && order.some(([key]) => key === "detail_rank"))
    return {
      status: 400,
      json: {
        code: "42703",
        message: "column reviews.detail_rank does not exist",
      },
    };
  const value = (entry: Review, key: string) =>
    key === "detail_rank" ? detailRank(entry) : entry[key as keyof Review];
  rows = [...rows].sort((a, b) => {
    for (const [key, direction] of order) {
      const x = value(a, key) ?? "";
      const y = value(b, key) ?? "";
      if (x !== y) return (x < y ? -1 : 1) * (direction === "desc" ? -1 : 1);
    }
    return 0;
  });
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const limit = url.searchParams.get("limit");
  const page = rows.slice(offset, limit ? offset + Number(limit) : undefined);
  const range = page.length
    ? `${offset}-${offset + page.length - 1}/${rows.length}`
    : `*/${rows.length}`;
  return {
    status: 200,
    headers: {
      "content-range": range,
      "access-control-expose-headers": "content-range",
    },
    ...(method === "HEAD" ? { body: "" } : { json: page }),
  };
}
async function backend(page: Page, initial: Review[] = []) {
  await mockCaptcha(page);
  const prepared = new Map<string, Record<string, unknown>>();
  const state = {
    reviews: initial,
    inserts: [] as Record<string, unknown>[],
    uploads: [] as string[],
    downloads: [] as string[],
    renders: [] as string[],
    queries: [] as URL[],
    uploadFails: false,
    insertFails: false,
    leakUnapproved: false,
    detailRankMissing: false,
  };
  await page.route("**/api/reviews", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const body = route.request().postDataJSON();
    if (body.action === "prepare") {
      if (body.captchaToken !== "test-captcha-token")
        return route.fulfill({
          status: 400,
          json: { error: "CAPTCHA_FAILED" },
        });
      const extension =
        body.imageType === "image/jpeg" ? "jpg" : body.imageType?.split("/")[1];
      const path = extension ? `${body.id}/photo.${extension}` : null;
      prepared.set(body.id, {
        id: body.id,
        title: body.title,
        description: body.description,
        rating: body.rating,
        image_path: path,
      });
      return route.fulfill({
        json: {
          id: body.id,
          completed: false,
          ...(path ? { upload: { path, token: "test-upload-token" } } : {}),
        },
      });
    }
    const row = prepared.get(body.id)!;
    state.inserts.push(row);
    if (state.insertFails)
      return route.fulfill({ status: 503, json: { error: "UNAVAILABLE" } });
    state.reviews.push(review({ ...row, status: "pending" }));
    return route.fulfill({ json: { id: body.id, completed: true } });
  });
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
    if (url.pathname.startsWith("/storage/v1/render/image/")) {
      state.renders.push(url.pathname);
      return route.fulfill({ contentType: "image/png", body: PHOTO });
    }
    if (url.pathname.startsWith("/storage/v1/object/")) {
      if (request.method() === "GET") {
        state.downloads.push(url.pathname);
        return route.fulfill({ contentType: "image/png", body: PHOTO });
      }
      if (request.method() === "POST" || request.method() === "PUT") {
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
      if (request.method() === "GET" || request.method() === "HEAD") {
        state.queries.push(url);
        return route.fulfill(respond(url, request.method(), state));
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
/** The home page, scrolled to the reviews: they load as a visitor nears them. */
async function openReviews(page: Page) {
  await page.goto("/");
  await page.locator("#reviews").scrollIntoViewIfNeeded();
}
async function openForm(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Donner mon avis", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", {
      name: "Partagez votre expérience",
      level: 3,
    }),
  ).toBeVisible();
  await expect(dialog.getByText("CAPTCHA test widget")).toBeVisible();
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

function approvedReviews(ratings: number[]) {
  return ratings.map((rating, index) =>
    review({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      title: `Avis publié ${index + 1}`,
      rating,
      created_at: `2026-09-${String(20 - index).padStart(2, "0")}T10:00:00Z`,
    }),
  );
}

test("the summary counts every approved review and the wall pages on the server", async ({
  page,
}) => {
  const approved = approvedReviews([5, 4, 4, 3, 5, 2, 1, 5]);
  const state = await backend(page, [
    ...approved,
    review({ id: "pending", title: "Avis en attente", status: "pending" }),
    review({ id: "rejected", title: "Avis refusé", status: "rejected" }),
  ]);
  // The UI must fail closed even if an API accidentally returns extra records.
  state.leakUnapproved = true;
  await page.goto("/");
  // Far down the page, the reviews are not part of the page load.
  await page.waitForLoadState("networkidle");
  expect(state.queries).toHaveLength(0);
  await page.locator("#reviews").scrollIntoViewIfNeeded();
  const section = page.locator("#reviews");
  const summary = section.getByRole("region", { name: "Note de nos clients" });
  await expect(summary.locator(".reviews-score strong")).toHaveText("3,6");
  await expect(summary.locator(".reviews-score p")).toHaveText("(8 avis)");
  await expect(summary.getByRole("heading")).toHaveText("Une bonne note");
  await expect(
    summary.getByRole("list", { name: "Répartition des notes" }).locator("li"),
  ).toHaveText([
    /5 étoiles\s*38%/,
    /4 étoiles\s*25%/,
    /3 étoiles\s*13%/,
    /2 étoiles\s*13%/,
    /1 étoile\s*13%/,
  ]);

  const cards = section.locator(".review-card");
  await expect(cards).toHaveCount(6);
  await expect(cards.first().getByRole("heading")).toHaveText(
    approved[0].title,
  );
  await expect(section).not.toContainText("Avis en attente");
  await expect(section).not.toContainText("Avis refusé");
  await expect(section.locator(".review-range")).toHaveText("Avis 1–6 sur 8");
  // Only one page of rows is requested, never the whole table.
  const listQueries = state.queries.filter((url) =>
    url.searchParams.has("limit"),
  );
  expect(listQueries.length).toBeGreaterThan(0);
  expect(
    listQueries.every(
      (url) =>
        url.searchParams.get("limit") === "6" &&
        url.searchParams.get("offset") === "0",
    ),
  ).toBe(true);
  expect(
    state.queries.every(
      (url) => url.searchParams.get("status") === "eq.approved",
    ),
  ).toBe(true);

  const pages = section.getByRole("navigation", { name: "Pages des avis" });
  const previous = pages.getByRole("button", { name: "Précédent" });
  await expect(previous).toBeDisabled();
  await expect(pages.getByRole("button", { name: "Page 1" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await pages.getByRole("button", { name: "Suivant" }).click();
  await expect(cards).toHaveCount(2);
  await expect(cards.first().getByRole("heading")).toHaveText(
    approved[6].title,
  );
  await expect(pages.getByRole("button", { name: "Page 2" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(section.locator(".review-range")).toHaveText("Avis 7–8 sur 8");
  await expect(section.locator(".reviews-grid")).toBeFocused();
  expect(
    state.queries.some((url) => url.searchParams.get("offset") === "6"),
  ).toBe(true);
  await previous.click();
  await expect(cards).toHaveCount(6);
  await expect(summary.locator(".reviews-score strong")).toHaveText("3,6");
});

test("visitors sort by relevance, newest or rating, and pages stay in range", async ({
  page,
}) => {
  const approved = approvedReviews([3, 4, 5, 2, 5, 4, 1, 5]);
  approved[5].image_path = `${approved[5].id}/photo.png`;
  approved[6].description = "";
  const state = await backend(page, approved);
  await openReviews(page);
  const section = page.locator("#reviews");
  const titles = section.locator(".review-card h3");
  const sorts = section.getByRole("group", { name: "Trier les avis" });
  const all = sorts.getByRole("button", { name: "Tous" });
  const recent = sorts.getByRole("button", { name: "Les plus récents" });
  const top = sorts.getByRole("button", { name: "Les mieux notés" });
  // "All" puts the most complete reviews, such as those with a photo, first.
  await expect(all).toHaveAttribute("aria-pressed", "true");
  await expect(titles.first()).toHaveText(approved[5].title);

  await recent.click();
  await expect(recent).toHaveAttribute("aria-pressed", "true");
  await expect(all).toHaveAttribute("aria-pressed", "false");
  await expect(titles).toHaveText(approved.slice(0, 6).map((r) => r.title));

  await section
    .getByRole("navigation", { name: "Pages des avis" })
    .getByRole("button", { name: "Page 2" })
    .click();
  await expect(titles).toHaveText(approved.slice(6).map((r) => r.title));
  // Changing the order starts again from the first page.
  await top.click();
  await expect(titles.first()).toHaveText(approved[2].title);
  await expect(titles).toHaveCount(6);
  await expect(
    section.locator(".review-card").first().getByRole("img").first(),
  ).toHaveAccessibleName("5 étoiles");
  expect(
    state.queries.some((url) =>
      url.searchParams.get("order")?.startsWith("rating.desc"),
    ),
  ).toBe(true);

  // Moderation can remove the page a visitor is reading.
  await section
    .getByRole("navigation", { name: "Pages des avis" })
    .getByRole("button", { name: "Page 2" })
    .click();
  await expect(titles).toHaveCount(2);
  state.reviews = state.reviews.slice(0, 5);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(titles).toHaveCount(5);
  await expect(section.getByRole("navigation")).toHaveCount(0);
});

test("before the pagination migration, All falls back to newest first", async ({
  page,
}) => {
  const approved = approvedReviews([4, 5]);
  approved[1].image_path = `${approved[1].id}/photo.png`;
  const state = await backend(page, approved);
  state.detailRankMissing = true;
  await openReviews(page);
  const titles = page.locator("#reviews .review-card h3");
  await expect(titles).toHaveText([approved[0].title, approved[1].title]);
  await expect(page.locator("#reviews [role=alert]")).toHaveCount(0);
});

test("an empty review wall invites the first review without inventing a score", async ({
  page,
}) => {
  await backend(page);
  await openReviews(page);
  const section = page.locator("#reviews");
  await expect(
    section.getByRole("heading", {
      name: "Le premier avis sera peut-être le vôtre.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(section.locator(".reviews-summary")).toHaveCount(0);
  await expect(section.locator(".review-card")).toHaveCount(0);
  await expect(section.getByRole("group")).toHaveCount(0);
  await expect(section.getByRole("navigation")).toHaveCount(0);
  await expect(
    section.getByRole("button", { name: "Donner mon avis", exact: true }),
  ).toBeVisible();
});

test("review cards fit French and Arabic screens and photos load as thumbnails", async ({
  page,
}) => {
  const photoPath = "00000000-0000-4000-8000-000000000001/photo.png";
  const state = await backend(page, [
    review({
      title: "Une très bonne adresse pour partager un repas en famille",
      description: "Un accueil chaleureux et un shawarma délicieux. ".repeat(8),
      image_path: photoPath,
    }),
    review({
      id: "second",
      title: "Super".repeat(18),
      description: "Très bon repas.",
      created_at: "2026-09-06T10:00:00Z",
    }),
    review({
      id: "third",
      title: "تجربة جميلة مع العائلة",
      description: "شكراً على الاستقبال الجميل والطعام اللذيذ.",
      created_at: "2026-09-05T10:00:00Z",
    }),
  ]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const section = page.locator("#reviews");
  await expect(section.locator(".review-card")).toHaveCount(3);
  for (const locale of ["fr", "ar"]) {
    if (locale === "ar") {
      await page
        .getByRole("button", { name: "FR Langue", exact: true })
        .click();
      await page.getByRole("menuitemradio", { name: "العربية" }).click();
    }
    await expect(page.locator("html")).toHaveAttribute(
      "dir",
      locale === "ar" ? "rtl" : "ltr",
    );
    for (const width of [1440, 820, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      await expect(section.locator(".review-card h3").first()).toBeVisible();
      expect(
        await section.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
        `review section overflow: ${locale} at ${width}px`,
      ).toBe(true);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `page overflow: ${locale} at ${width}px`,
      ).toBe(true);
      await section.screenshot({
        path: `test-results/reviews-${locale}-${width}.png`,
      });
    }
  }
  // Arabic uses Western digits, as on the restaurant's menus.
  await expect(section.locator(".reviews-score strong")).toHaveText("5.0");
  await expect(section.locator(".reviews-score p")).toHaveText("(3 تقييمات)");

  // Cards stay compact: the text is clamped and the photo is a small,
  // resized thumbnail beside it, never the original upload.
  const title = "Une très bonne adresse pour partager un repas en famille";
  const card = section.locator(".review-card").filter({ hasText: title });
  const text = card.locator(".review-card-main > p");
  expect(
    await text.evaluate(
      (element) => element.scrollHeight > element.clientHeight,
    ),
  ).toBe(true);
  await expect(card.locator('.review-thumb img[src^="blob:"]')).toBeAttached();
  expect(state.renders).toContain(
    `/storage/v1/render/image/authenticated/review-images/${photoPath}`,
  );
  const cardBox = (await card.boundingBox())!;
  const thumbBox = (await card.locator(".review-thumb").boundingBox())!;
  expect(
    thumbBox.y - cardBox.y,
    "the photo sits beside the title",
  ).toBeLessThan(30);

  // Tapping anywhere on the card opens the whole review in a popup.
  const open = card.getByRole("button", { name: title, exact: true });
  await card.click({ position: { x: 30, y: cardBox.height - 20 } });
  const dialog = page.getByRole("dialog", { name: title });
  await expect(dialog.locator('img[src^="blob:"]')).toBeVisible();
  const full = dialog.locator(".review-detail > p");
  await expect(full).toHaveText(
    "Un accueil chaleureux et un shawarma délicieux. ".repeat(8).trim(),
  );
  expect(
    await full.evaluate(
      (element) => element.scrollHeight <= element.clientHeight,
    ),
    "the popup shows the whole review",
  ).toBe(true);
  expect(state.downloads).toHaveLength(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(open).toBeFocused();
  // Keyboard users reach the same popup from the card's title.
  await open.press("Enter");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
});

test("review form loads on demand and stays dismissible while downloading", async ({
  page,
}) => {
  await backend(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let requested = false;
  let release!: () => void;
  const download = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    /\/ReviewForm(?:\.tsx|-[^/]+\.js)(?:\?.*)?$/,
    async (route) => {
      requested = true;
      await download;
      await route.continue();
    },
  );
  await page.goto("/");
  const open = page.getByRole("button", {
    name: "Donner mon avis",
    exact: true,
  });
  await expect(open).toBeVisible();
  expect(requested).toBe(false);
  await open.click();
  await expect.poll(() => requested).toBe(true);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("status")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  release();
  await open.click();
  await expect(dialog.getByLabel("Titre", { exact: true })).toBeVisible();
  await expect(dialog.getByText("CAPTCHA test widget")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(open).toBeFocused();
  expect(errors).toEqual([]);
});

test("CAPTCHA expiry blocks submission and a third review is refused after reload", async ({
  page,
}) => {
  const state = await backend(page);
  let requests = 0;
  await page.route("**/api/reviews", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    requests++;
    if (state.reviews.length >= 2)
      return route.fulfill({ status: 429, json: { error: "DAILY_LIMIT" } });
    return route.fallback();
  });
  let directWrites = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().includes("/rest/v1/reviews")
    )
      directWrites++;
  });
  let dialog = await openForm(page);
  await fillReview(page);
  await page.evaluate(() => {
    const captcha = (
      window as unknown as { testCaptchaOptions: Record<string, () => void> }
    ).testCaptchaOptions;
    captcha["expired-callback"]();
  });
  await dialog
    .getByRole("button", { name: "Envoyer mon avis", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Veuillez terminer la vérification anti-robot.",
  );
  expect(requests).toBe(0);
  await page.keyboard.press("Escape");
  for (const n of [1, 2]) {
    dialog = await openForm(page);
    await fillReview(page, `Avis ${n}`);
    await dialog
      .getByRole("button", { name: "Envoyer mon avis", exact: true })
      .click();
    await expect(page.getByText(SUCCESS, { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
  }
  dialog = await openForm(page);
  await fillReview(page, "Troisième avis");
  await dialog
    .getByRole("button", { name: "Envoyer mon avis", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "La limite de deux avis",
  );
  await expect(page.getByText(SUCCESS, { exact: true })).toHaveCount(0);
  expect(state.reviews).toHaveLength(2);
  expect(directWrites).toBe(0);
});

test("review form supports keyboard stars and Arabic on narrow screens", async ({
  page,
}) => {
  await backend(page);
  const dialog = await openForm(page);
  const firstStar = dialog.getByRole("radio", {
    name: "1 étoile",
    exact: true,
  });
  await firstStar.focus();
  await firstStar.press("Space");
  await firstStar.press("ArrowRight");
  await expect(
    dialog.getByRole("radio", { name: "2 étoiles", exact: true }),
  ).toBeChecked();
  await dialog.screenshot({ path: "test-results/review-form-desktop.png" });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "FR Langue", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "العربية" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByRole("button", { name: "أضف رأيك", exact: true }).click();
    const form = page.getByRole("dialog");
    await expect(form.getByLabel("العنوان", { exact: true })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(await form.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
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
  await openReviews(page);
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
    `/storage/v1/object/upload/sign/review-uploads/${row.image_path}`,
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
  test(`only rating and title are required (description: ${description || "empty"})`, async ({
    page,
  }) => {
    const state = await backend(page);
    const dialog = await openForm(page);
    await dialog.getByLabel("Titre", { exact: true }).fill("A");
    await dialog.getByRole("radio", { name: "5 étoiles", exact: true }).check();
    const reviewText = dialog.getByLabel("Votre avis (facultatif)", {
      exact: true,
    });
    await expect(reviewText).not.toHaveAttribute("required", "");
    await reviewText.fill(description);
    await dialog
      .getByRole("button", { name: "Envoyer mon avis", exact: true })
      .click();
    await expect(page.getByText(SUCCESS, { exact: true })).toBeVisible();
    expect(state.uploads).toHaveLength(0);
    expect(state.inserts).toHaveLength(1);
    expect(state.inserts[0]).toMatchObject({
      title: "A",
      rating: 5,
      description,
      image_path: null,
    });
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
