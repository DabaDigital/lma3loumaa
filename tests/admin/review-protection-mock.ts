import type { Page } from "@playwright/test";

export async function mockCaptcha(page: Page) {
  await page.route("**/api/reviews", async (route, next) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { siteKey: "test-site-key" } });
    return route.fallback();
  });
  await page.route(
    "https://challenges.cloudflare.com/turnstile/v0/api.js*",
    (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: `window.turnstile = {
      render(el, options) { window.testCaptchaOptions = options; el.textContent = 'CAPTCHA test widget'; queueMicrotask(() => options.callback('test-captcha-token')); return 'test-widget'; },
      remove() {}
    };`,
      }),
  );
}
