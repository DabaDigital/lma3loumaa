import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { Review } from "../../src/reviews";

const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const initialReviews: Review[] = [
  {
    id: "00000000-0000-4000-8000-000000000011",
    title: "A delicious family lunch",
    description:
      "Fresh shawarma, crispy fries and a generous portion.\nWe will visit again!",
    rating: 5,
    image_path: "00000000-0000-4000-8000-000000000011/photo.png",
    status: "pending",
    created_at: "2026-09-07T12:00:00Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000012",
    title: "Our favourite lunch stop",
    description: "Really good rolls and a friendly welcome.",
    rating: 4,
    image_path: null,
    status: "approved",
    created_at: "2026-09-06T12:00:00Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000013",
    title: "Already moderated",
    description: "An earlier review awaiting a different decision.",
    rating: 2,
    image_path: null,
    status: "rejected",
    created_at: "2026-09-05T12:00:00Z",
  },
];

async function backend(page: Page, admin = true) {
  const state = {
    rows: structuredClone(initialReviews),
    loadFails: false,
    updateMode: "ok" as "ok" | "denied" | "empty",
    photoRequests: [] as string[],
    photoFails: false,
    reviewReads: 0,
    reviewOffsets: [] as number[],
  };
  const user = {
    id: "00000000-0000-0000-0000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "admin@example.com",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-09-01T12:00:00Z",
  };
  await page.route("https://test-project.supabase.co/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname.includes("/auth/v1/token")) {
      return route.fulfill({
        json: {
          access_token: "test-access-token",
          refresh_token: "test-refresh-token",
          expires_in: 3600,
          token_type: "bearer",
          user,
        },
      });
    }
    if (url.pathname.includes("/auth/v1/user"))
      return route.fulfill({ json: user });
    if (url.pathname.includes("/auth/v1/logout"))
      return route.fulfill({ status: 204 });
    if (url.pathname.startsWith("/storage/v1/object/")) {
      state.photoRequests.push(url.pathname);
      if (state.photoFails)
        return route.fulfill({
          status: 404,
          json: { message: "Photo unavailable" },
        });
      return route.fulfill({ contentType: "image/png", body: PIXEL });
    }
    const table = url.pathname.split("/").at(-1);
    if (table === "admin_users")
      return route.fulfill({ json: admin ? { user_id: user.id } : null });
    if (table === "reviews") {
      if (req.method() === "PATCH") {
        if (state.updateMode === "denied")
          return route.fulfill({
            status: 403,
            json: { message: "Access denied" },
          });
        if (state.updateMode === "empty") return route.fulfill({ json: [] });
        const id = url.searchParams.get("id")?.replace("eq.", "");
        const row = state.rows.find((review) => review.id === id)!;
        row.status = req.postDataJSON().status;
        return route.fulfill({ json: { id: row.id, status: row.status } });
      }
      state.reviewReads++;
      if (state.loadFails)
        return route.fulfill({ status: 503, json: { message: "Unavailable" } });
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? state.rows.length);
      state.reviewOffsets.push(offset);
      return route.fulfill({ json: state.rows.slice(offset, offset + limit) });
    }
    if (["menu_items", "categories", "locations"].includes(table ?? "")) {
      return route.fulfill({ json: [] });
    }
    return route.fulfill({ status: 404 });
  });
  return state;
}

async function login(page: Page) {
  await page.goto("/admin/reviews");
  await page.getByLabel("Adresse e-mail").fill("admin@example.com");
  await page.getByLabel("Mot de passe", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
}

test("reviews require approval, display full details and allow changing decisions", async ({
  page,
}) => {
  const state = await backend(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Avis clients", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation").getByRole("button", { name: "Avis clients" }),
  ).toHaveAttribute("aria-current", "page");
  const pending = page.getByRole("article", { name: initialReviews[0].title });
  await expect(pending).toContainText("Fresh shawarma, crispy fries");
  await expect(
    pending.getByRole("img", { name: "5 étoiles sur 5" }),
  ).toBeVisible();
  await expect(pending.locator("time")).toHaveAttribute(
    "datetime",
    initialReviews[0].created_at,
  );
  const photo = pending.getByRole("img", {
    name: `Photo · ${initialReviews[0].title}`,
  });
  await expect(photo).toBeVisible();
  await expect(photo).toHaveJSProperty("naturalWidth", 1);
  await pending.getByRole("button", { name: `Photo · ${initialReviews[0].title}`, exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("img")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.photoRequests[0]).toContain("/review-images/");
  expect(state.photoRequests[0]).not.toContain("/public/");
  await expect(page.getByRole("article")).toHaveCount(1);
  await pending
    .getByRole("button", { name: `Approuver · ${initialReviews[0].title}` })
    .click();
  await expect(page.getByRole("status")).toHaveText("Avis approuvé et publié.");
  await expect(page.getByRole("article")).toHaveCount(0);
  expect(state.rows[0].status).toBe("approved");

  await page.getByRole("button", { name: "Approuvés 2", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(2);
  await page.screenshot({ path: "test-results/reviews-admin-desktop.png", fullPage: true });
  await pending
    .getByRole("button", { name: `Refuser · ${initialReviews[0].title}` })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Avis refusé et masqué du site.",
  );
  await expect(pending).toHaveCount(0);
  expect(state.rows[0].status).toBe("rejected");

  await page.getByRole("button", { name: "Refusés 2", exact: true }).click();
  await expect(pending).toBeVisible();
  await expect(
    pending.getByRole("button", {
      name: `Refuser · ${initialReviews[0].title}`,
    }),
  ).toBeDisabled();
  await pending
    .getByRole("button", { name: `Approuver · ${initialReviews[0].title}` })
    .click();
  await expect(page.getByRole("status")).toHaveText("Avis approuvé et publié.");
  await expect(pending).toHaveCount(0);
  expect(state.rows[0].status).toBe("approved");
  expect(errors).toEqual([]);
});

test("failed and zero-row moderation keep the review pending without false success", async ({
  page,
}) => {
  const state = await backend(page);
  await login(page);
  const pending = page.getByRole("article", { name: initialReviews[0].title });
  await expect(pending).toBeVisible();
  for (const mode of ["denied", "empty"] as const) {
    state.updateMode = mode;
    await pending
      .getByRole("button", { name: `Approuver · ${initialReviews[0].title}` })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "L’opération a échoué.",
    );
    await expect(pending).toBeVisible();
    await expect(
      pending.getByRole("button", {
        name: `Approuver · ${initialReviews[0].title}`,
      }),
    ).toBeEnabled();
    await expect(page.getByRole("status")).toHaveCount(0);
    expect(state.rows[0].status).toBe("pending");
  }
  state.updateMode = "ok";
  await pending
    .getByRole("button", { name: `Approuver · ${initialReviews[0].title}` })
    .click();
  await expect(page.getByRole("status")).toHaveText("Avis approuvé et publié.");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("load errors can be retried and filters, search and refresh have honest empty states", async ({
  page,
}) => {
  const state = await backend(page);
  state.loadFails = true;
  await login(page);
  // PostgREST retries 503 responses after 1, 2 and 4 seconds before reporting failure.
  await expect(page.getByRole("alert")).toContainText(
    "Impossible de charger les données.",
    { timeout: 12000 },
  );
  await expect(
    page.getByRole("heading", { name: "Aucun avis dans cette sélection." }),
  ).toHaveCount(0);
  state.loadFails = false;
  state.rows = [];
  await page.getByRole("button", { name: "Réessayer", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Aucun avis dans cette sélection." }),
  ).toBeVisible();
  state.rows = structuredClone(initialReviews);
  await page
    .getByRole("button", { name: "Actualiser les avis", exact: true })
    .click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await page
    .getByRole("searchbox", { name: "Rechercher un avis…" })
    .fill("nonexistent");
  await expect(page.getByRole("article")).toHaveCount(0);
  await page
    .getByRole("searchbox", { name: "Rechercher un avis…" })
    .fill("crispy fries");
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("searchbox", { name: "Rechercher un avis…" }).fill("");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Vue d’ensemble", exact: true })
    .click();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Avis clients", exact: true }),
  ).toBeVisible();
});

test("review moderation works on mobile in Arabic and English", async ({
  page,
}) => {
  await backend(page);
  await login(page);
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("button", { name: "Langue", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "العربية" }).click();
  await expect(
    page.getByRole("heading", { name: "آراء الزبائن", exact: true }),
  ).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width + 1);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "admin-test-results/reviews-ar-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "اللغة", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "English" }).click();
  await expect(
    page.getByRole("heading", { name: "Customer reviews", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "5 out of 5 stars" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: `Reject · ${initialReviews[0].title}` })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Review rejected and hidden from the website.",
  );
});

test("signed-in accounts without admin access cannot load the moderation interface", async ({
  page,
}) => {
  const state = await backend(page, false);
  await login(page);
  await expect(page.getByRole("alert")).toHaveText(
    "Ce compte n’a pas accès à l’administration.",
  );
  await expect(
    page.getByRole("heading", { name: "Avis clients", exact: true }),
  ).toHaveCount(0);
  expect(state.reviewReads).toBe(0);
});

test("older pending reviews remain available when more than 200 reviews exist", async ({
  page,
}) => {
  const state = await backend(page);
  state.rows = Array.from({ length: 211 }, (_, index) => ({
    ...initialReviews[1],
    id: `00000000-0000-4000-8000-${String(index + 100).padStart(12, "0")}`,
    title: `Customer visit ${index + 1}`,
    status: index === 210 ? "pending" : "approved",
    created_at: new Date(Date.UTC(2026, 8, 7, 12, 0, -index)).toISOString(),
  }));
  await login(page);
  const oldest = page.getByRole("article", { name: "Customer visit 211" });
  await expect(oldest).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approuvés 210", exact: true }),
  ).toBeVisible();
  expect(state.reviewOffsets.some((offset) => offset > 0)).toBe(true);
  await oldest
    .getByRole("button", {
      name: "Approuver · Customer visit 211",
      exact: true,
    })
    .click();
  await expect(page.getByRole("status")).toHaveText("Avis approuvé et publié.");
  await expect(
    page.getByRole("button", { name: "Approuvés 211", exact: true }),
  ).toBeVisible();
  expect(state.rows.at(-1)?.status).toBe("approved");
});

test("an unavailable review photo does not prevent reading or rejecting a review", async ({
  page,
}) => {
  const state = await backend(page);
  state.photoFails = true;
  await login(page);
  const pending = page.getByRole("article", { name: initialReviews[0].title });
  await expect(
    pending.getByRole("img", { name: "Photo indisponible", exact: true }),
  ).toBeVisible();
  await expect(pending).toContainText(initialReviews[0].description);
  await pending
    .getByRole("button", { name: `Refuser · ${initialReviews[0].title}` })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Avis refusé et masqué du site.",
  );
  expect(state.rows[0].status).toBe("rejected");
});
