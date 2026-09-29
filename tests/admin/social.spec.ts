import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { categories, items, locations } from "../../src/data";

// The follow-us section and its dashboard: social and ordering links, and the
// four posts and reels. Supabase and the platforms' players are stand-ins.
const GLOVO =
  "https://glovoapp.com/fr/ma/casablanca/stores/shawarma-lma3louma-cas";
const INSTAGRAM = "https://www.instagram.com/lma3loumaa/";
const link = (platform: string, kind: string, url: string, sort_order = 0) => ({
  id: platform,
  kind,
  platform,
  label: "",
  url,
  available: true,
  sort_order,
});
const post = (
  id: string,
  url: string,
  sort_order: number,
  video: string | null = null,
) => ({ id, url, video, poster: null, caption: "", available: true, sort_order });

async function backend(page: Page) {
  const data: Record<string, any[]> = {
    categories: categories
      .filter((c) => c.id !== "all")
      .map((c, i) => ({ ...c, available: true, sort_order: i })),
    menu_items: items.map((c, i) => ({ ...c, available: true, sort_order: i })),
    locations: locations.map((c, i) => ({ ...c, available: true, sort_order: i })),
    reviews: [],
    site_links: [link("instagram", "social", INSTAGRAM), link("glovo", "order", GLOVO)],
    social_posts: [],
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
    const request = route.request();
    const url = new URL(request.url());
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
    if (url.pathname.includes("/auth/v1/user")) return route.fulfill({ json: user });
    if (url.pathname.startsWith("/storage/v1/object/"))
      return route.fulfill({ json: { Key: url.pathname } });
    const table = url.pathname.split("/").at(-1)!;
    if (table === "admin_users") return route.fulfill({ json: { user_id: user.id } });
    if (!(table in data)) return route.fulfill({ status: 404, json: {} });
    const id = url.searchParams.get("id")?.replace("eq.", "");
    if (request.method() === "POST") {
      const row = request.postDataJSON();
      data[table].push(row);
      return route.fulfill({ json: { id: row.id } });
    }
    if (request.method() === "PATCH") {
      const index = data[table].findIndex((row) => row.id === id);
      data[table][index] = { ...data[table][index], ...request.postDataJSON() };
      return route.fulfill({ json: { id } });
    }
    if (request.method() === "DELETE") {
      data[table] = data[table].filter((row) => row.id !== id);
      return route.fulfill({ json: { id } });
    }
    return route.fulfill({ json: data[table] });
  });
  return data;
}

// TikTok's stand-in records the commands it receives, like the real player's
// postMessage API; Instagram's reports a 600px height, as its embed does.
async function stubPlayers(page: Page) {
  const html = (body: string) =>
    `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${body}</body></html>`;
  await page.route("https://www.tiktok.com/player/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: html(`<script>
        window.commands = [];
        addEventListener("message", (event) => {
          if (event.data["x-tiktok-player"]) commands.push(event.data.type);
        });
        parent.postMessage({ "x-tiktok-player": true, type: "onPlayerReady" }, "*");
      </script>`),
    }),
  );
  await page.route("https://www.instagram.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: html(`<div style="height:600px"></div><script>
        parent.postMessage(JSON.stringify({ type: "MEASURE", details: { height: 600 } }), "*");
      </script>`),
    }),
  );
  await page.route("https://www.facebook.com/plugins/**", (route) =>
    route.fulfill({ contentType: "text/html", body: html("") }),
  );
}

async function openLinks(page: Page) {
  await page.goto("/admin");
  await page.getByLabel("Adresse e-mail").fill("admin@example.com");
  await page.getByLabel("Mot de passe", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Réseaux & liens/ })
    .click();
  await expect(page).toHaveURL(/\/admin\/links$/);
}

test("social and ordering links are an open list, saved together and shown on the website", async ({
  page,
}) => {
  const data = await backend(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const facebook = "https://web.facebook.com/shawarma.lma3louma/";
  const threads = "https://www.threads.net/@lma3loumaa";
  const klit = "https://app.klit.ma/restaurants/lma3louma";
  await openLinks(page);
  const panel = page.locator(".admin-list-panel").first();
  const save = panel.getByRole("button", { name: "Enregistrer", exact: true });
  await expect(save).toBeDisabled();
  await expect(page.getByLabel("Lien · Glovo", { exact: true })).toHaveValue(GLOVO);
  // Glovo is permanent: it cannot be hidden, moved or deleted.
  await expect(panel.getByRole("button", { name: /· Glovo$/ })).toHaveCount(0);

  // A new row picks the next unused platform and takes the focus.
  const addSocial = panel.getByRole("button", { name: "Ajouter un réseau" });
  await addSocial.click();
  const facebookUrl = page.getByLabel("Lien · Facebook", { exact: true });
  await expect(facebookUrl).toBeFocused();
  await facebookUrl.fill(facebook);
  await addSocial.click();
  await page.getByRole("combobox", { name: "Plateforme · TikTok", exact: true }).click();
  await page.getByRole("option", { name: "Autre…", exact: true }).click();
  await page.getByLabel("Nom affiché · 3", { exact: true }).fill("Threads");
  await page.getByLabel("Lien · Threads", { exact: true }).fill(threads);
  await page.getByRole("button", { name: "Monter · Facebook", exact: true }).click();
  await page
    .getByRole("button", { name: "Masquer du site · Instagram", exact: true })
    .click();
  await panel.getByRole("button", { name: "Ajouter un lien de commande" }).click();
  const klitUrl = page.getByLabel("Lien · Klit", { exact: true });
  // Only complete HTTPS links are sent.
  await klitUrl.fill("app.klit.ma/restaurants/lma3louma");
  await save.click();
  expect(await klitUrl.evaluate((el: HTMLInputElement) => el.checkValidity())).toBe(
    false,
  );
  expect(data.site_links).toHaveLength(2);
  await klitUrl.fill(klit);
  // A removed row is only gone once saved.
  await addSocial.click();
  await page.getByRole("button", { name: "Supprimer · TikTok", exact: true }).click();
  await expect(panel).toContainText("Modifications non enregistrées");
  await save.click();
  await expect(page.locator(".admin-notice")).toHaveText("Modifications enregistrées.");
  await expect(save).toBeDisabled();
  const saved = Object.fromEntries(
    data.site_links.map(({ platform, kind, label, url, available, sort_order }) => [
      platform === "other" ? label : platform,
      { kind, url, available, sort_order },
    ]),
  );
  expect(saved).toEqual({
    facebook: { kind: "social", url: facebook, available: true, sort_order: 0 },
    instagram: { kind: "social", url: INSTAGRAM, available: false, sort_order: 1 },
    Threads: { kind: "social", url: threads, available: true, sort_order: 2 },
    glovo: { kind: "order", url: GLOVO, available: true, sort_order: 0 },
    klit: { kind: "order", url: klit, available: true, sort_order: 1 },
  });

  await page.goto("/");
  const section = page.locator(".social-section");
  const profiles = section.locator(".social-profile");
  await expect(profiles).toHaveCount(2);
  await expect(profiles.nth(0)).toContainText("shawarma.lma3louma");
  await expect(profiles.nth(1)).toContainText("Threads@lma3loumaa");
  await expect(section.locator(".social-heading")).toContainText(
    "sur Facebook et Threads.",
  );
  // The call to action follows the first two profiles.
  await expect(
    section.getByRole("link", { name: "Voir plus sur Facebook" }),
  ).toHaveAttribute("href", facebook);
  await expect(
    section.getByRole("link", { name: "ou suivez-nous sur Threads" }),
  ).toHaveAttribute("href", threads);
  const footer = page.locator("footer");
  await expect(footer.getByRole("link", { name: "Instagram" })).toHaveCount(0);
  await expect(footer.getByRole("link", { name: "Threads" })).toHaveAttribute(
    "href",
    threads,
  );
  const delivery = page.locator(".delivery-section");
  await expect(
    delivery.getByRole("link", { name: "Commander sur Klit" }),
  ).toHaveAttribute("href", klit);
  await delivery.getByRole("button").click();
  await expect(
    page.getByRole("dialog").getByRole("link", { name: "Commander sur Klit" }),
  ).toHaveAttribute("href", klit);

  // Unreadable link and post tables leave the menu intact, with Glovo and
  // the verified Instagram profile on their built-in defaults.
  await page.route(/\/rest\/v1\/(site_links|social_posts)/, (route) =>
    route.fulfill({ status: 404, json: { message: "missing" } }),
  );
  await page.goto("/");
  await expect(page.locator(".location-card")).toHaveCount(2);
  await expect(page.locator(".content-status")).toHaveCount(0);
  await expect(
    page.locator("footer").getByRole("link", { name: "Instagram" }),
  ).toHaveAttribute("href", INSTAGRAM);
  await expect(section.getByRole("listitem")).toHaveCount(4);
  await page.locator(".delivery-section").getByRole("button").click();
  await expect(
    page.getByRole("dialog").getByRole("link", { name: "Continuer sur Glovo" }),
  ).toHaveAttribute("href", GLOVO);
  expect(errors).toEqual([]);
});

test("posts and reels: recognized links, video uploads, four at most, in order", async ({
  page,
}) => {
  const data = await backend(page);
  await openLinks(page);
  const panel = page.locator(".admin-list-panel").nth(1);
  const add = panel.getByRole("button", { name: "Ajouter une publication" });
  const save = panel.getByRole("button", { name: "Enregistrer", exact: true });
  await expect(panel).toContainText("0 / 4");
  await expect(panel).toContainText("la section montre les photos du restaurant");

  await add.click();
  const first = page.getByLabel("Lien de la publication ou du reel 1", { exact: true });
  // Short TikTok links carry no video id, so the site could not show them.
  await first.fill("https://vm.tiktok.com/ZMabc/");
  await expect(panel).toContainText("utilisez le lien complet (…/video/…)");
  await save.click();
  expect(await first.evaluate((el: HTMLInputElement) => el.checkValidity())).toBe(false);
  await first.fill("https://www.tiktok.com/@lma3loumaa/video/7400000000000000001");
  await expect(panel).toContainText("Vidéo TikTok · Lecture automatique en sourdine");

  await add.click();
  await page
    .getByLabel("Lien de la publication ou du reel 2", { exact: true })
    .fill("https://www.instagram.com/reel/C1abcDEF/");
  await expect(panel).toContainText("Reel Instagram · Lecteur officiel");
  await panel.locator("summary").nth(1).click();
  const upload = page.getByLabel("Téléverser une vidéo 2", { exact: true });
  await upload.setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("x"),
  });
  await expect(panel.getByRole("alert")).toHaveText(
    "Format non pris en charge. Utilisez MP4 ou WebM.",
  );
  await upload.setInputFiles({
    name: "reel.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("video"),
  });
  await expect(page.getByLabel("Vidéo (MP4 ou WebM) 2", { exact: true })).toHaveValue(
    /^https:\/\/test-project\.supabase\.co\/storage\/v1\/object\/public\/social-media\/posts\/.+\.mp4$/,
  );
  // With its video file, an Instagram reel plays muted with a sound button.
  await expect(panel).toContainText("Reel Instagram · Lecture automatique en sourdine");

  for (const n of [3, 4]) {
    await add.click();
    await page
      .getByLabel(`Lien de la publication ou du reel ${n}`, { exact: true })
      .fill(`https://www.instagram.com/p/C9post${n}/`);
  }
  await expect(panel).toContainText("4 / 4");
  await expect(add).toBeDisabled();
  await expect(panel).toContainText("Limite de 4 publications atteinte.");
  await page.getByRole("button", { name: "Descendre · Vidéo TikTok 1", exact: true }).click();
  await page
    .getByRole("button", { name: "Masquer du site · Publication Instagram 4", exact: true })
    .click();
  await save.click();
  await expect(page.locator(".admin-notice")).toHaveText("Modifications enregistrées.");
  expect(data.social_posts).toHaveLength(4);
  const [reel, tiktok] = [...data.social_posts].sort((a, b) => a.sort_order - b.sort_order);
  expect(reel).toMatchObject({ url: "https://www.instagram.com/reel/C1abcDEF/", sort_order: 0 });
  expect(reel.video).toMatch(/social-media\/posts\/.+\.mp4$/);
  expect(tiktok).toMatchObject({ video: null, poster: null, sort_order: 1 });
  expect(data.social_posts.filter((row) => !row.available)).toHaveLength(1);

  // Deleting makes room again, and is saved with the rest.
  await page
    .getByRole("button", { name: "Supprimer · Publication Instagram 3", exact: true })
    .click();
  await expect(add).toBeEnabled();
  await save.click();
  await expect(save).toBeDisabled();
  expect(data.social_posts).toHaveLength(3);
});

test("four reels in a row start muted, keep one sound at a time and mute once scrolled away", async ({
  page,
}) => {
  const data = await backend(page);
  await stubPlayers(page);
  data.social_posts = [
    post("tiktok", "https://www.tiktok.com/@lma3loumaa/video/7400000000000000001", 0),
    post("reel", "https://www.instagram.com/reel/C1abcDEF/", 1, "/assets/reel.mp4"),
    post("instagram", "https://www.instagram.com/reel/C9xyz/", 2),
    post("facebook", "https://www.facebook.com/reel/123456789", 3),
    // A fifth, left over from a larger limit, is not shown.
    post("extra", "https://www.instagram.com/p/C9more/", 4),
  ];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const section = page.locator(".social-section");
  const cards = section.getByRole("list", { name: "Nos publications et reels" }).getByRole("listitem");
  await expect(cards).toHaveCount(4);
  await cards.first().scrollIntoViewIfNeeded();
  // One row on a wide screen: no carousel, no arrows.
  const tops = await cards.evaluateAll((all) =>
    all.map((card) => Math.round(card.getBoundingClientRect().top)),
  );
  expect(new Set(tops).size).toBe(1);
  await expect(cards.nth(0).locator(".social-chip")).toHaveText("Vidéo");
  await expect(cards.nth(1).locator(".social-chip")).toHaveText("Reel");
  await expect(cards.nth(0).getByRole("link", { name: "Voir la publication" })).toHaveAttribute(
    "href",
    "https://www.tiktok.com/@lma3loumaa/video/7400000000000000001",
  );

  const commands = async () => {
    const frame = page.frames().find((f) => f.url().includes("tiktok.com/player"));
    return frame ? frame.evaluate(() => (window as any).commands as string[]) : [];
  };
  // Muted on arrival, then playing once in view.
  await expect.poll(commands).toEqual(expect.arrayContaining(["mute", "play"]));
  expect(await commands()).not.toContain("unMute");
  const clip = cards.nth(1).locator("video");
  expect(await clip.evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);

  // Instagram's embed is shown whole: no scrollbar, scaled into its card.
  const embed = cards.nth(2).locator("iframe");
  await expect(embed).toHaveAttribute("src", "https://www.instagram.com/reel/C9xyz/embed/");
  await expect(embed).toHaveAttribute("scrolling", "no");
  await expect
    .poll(() =>
      embed.evaluate((frame) => {
        const box = frame.parentElement!.getBoundingClientRect();
        const shown = frame.getBoundingClientRect();
        return frame.style.height === "600px" && shown.bottom <= box.bottom + 1;
      }),
    )
    .toBe(true);
  await expect(cards.nth(3).locator("iframe")).toHaveAttribute(
    "src",
    /^https:\/\/www\.facebook\.com\/plugins\/video\.php\?show_text=false&href=https%3A%2F%2Fwww\.facebook\.com%2Freel%2F123456789&width=\d+&height=\d+$/,
  );

  await cards.nth(0).getByRole("button", { name: "Activer le son" }).click();
  await expect.poll(async () => (await commands()).at(-1)).toBe("unMute");
  // Turning another card's sound on mutes the first.
  await cards.nth(1).getByRole("button", { name: "Activer le son" }).click();
  expect(await clip.evaluate((v: HTMLVideoElement) => v.muted)).toBe(false);
  await expect
    .poll(async () => (await commands()).filter((c) => /^(un)?[mM]ute$/.test(c)).at(-1))
    .toBe("mute");
  await expect(cards.nth(0).getByRole("button", { name: "Activer le son" })).toBeVisible();

  // Far away, the sound goes off, and it stays off on the way back.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => clip.evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);
  await cards.first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  expect(await clip.evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);
  await expect(cards.nth(1).getByRole("button", { name: "Activer le son" })).toBeVisible();
  expect(errors).toEqual([]);
});

test.describe("phones", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("the reels pin, slide one screen-wide reel at a time, then release the page", async ({
    page,
  }) => {
    const data = await backend(page);
    await stubPlayers(page);
    data.social_posts = [
      post("one", "https://www.tiktok.com/@lma3loumaa/video/7400000000000000001", 0),
      post("two", "https://www.instagram.com/reel/C1abcDEF/", 1, "/assets/reel.mp4"),
      post("three", "https://www.instagram.com/reel/C9xyz/", 2),
      post("four", "https://www.facebook.com/reel/123456789", 3),
    ];
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    const runway = page.locator(".social-runway");
    await runway.scrollIntoViewIfNeeded();
    await expect(runway).toHaveAttribute("data-pinned", "true");
    const { top, travel, header } = await runway.evaluate((el) => ({
      top: el.getBoundingClientRect().top + scrollY,
      travel: parseFloat(getComputedStyle(el).getPropertyValue("--social-travel")),
      header: document.querySelector<HTMLElement>(".header")!.offsetHeight,
    }));
    const cards = runway.locator(".social-reel");
    const visible = () =>
      cards.evaluateAll((all) =>
        all.map((card) => {
          const r = card.getBoundingClientRect();
          return Math.round(Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)));
        }),
      );
    // Each reel takes the screen's width, one at a time.
    for (const index of [0, 1, 2, 3]) {
      await page.evaluate(
        (y) => window.scrollTo(0, y),
        Math.round(top - header + (travel * index) / 3),
      );
      await expect
        .poll(visible)
        .toEqual([0, 1, 2, 3].map((n) => (n === index ? 354 : 0)));
    }
    // Past the last reel the page scrolls on: the runway leaves the screen.
    await page.evaluate((y) => window.scrollTo(0, y), Math.round(top - header + travel + 900));
    await expect
      .poll(() => runway.evaluate((el) => el.getBoundingClientRect().bottom))
      .toBeLessThan(header);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
  });
});
