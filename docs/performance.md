# Lighthouse follow-up — 29 September 2026

Lighthouse 13.5 (default simulated throttling: mobile is a Moto G Power profile, 4× CPU, slow 4G), headless Chromium 141 on Linux, against production builds served with Brotli and the Vercel rewrites and cache headers. Supabase is replaced by a local mock with the built-in menu, three links, four posts and 18 reviews, so the page fetches and renders real content. Lab numbers from one machine; PageSpeed Insights runs the same Lighthouse on Google's servers against the deployed site, so expect some spread.

| Page | Original | After |
| --- | ---: | ---: |
| Home, mobile (5 runs) | 75–94, median 81 | 94–98, median 98 |
| Home, desktop | 99–100 | 100 |
| Full menu, mobile (3 runs) | 75–81 | 89–90 |
| Full menu, desktop | 99 | 100 |

Home mobile LCP went from 3.3–4.7 s to 2.2–2.3 s, TBT from 170–310 ms to 90–220 ms.

What made the difference:

- **Hero entrance.** `.shawarma-depth` faded in from `opacity: 0`. Chrome does not count an element first painted fully transparent as the largest paint until it repaints, which happened only once the app loaded, so Lighthouse charged the whole app download to LCP. The entrance now scales and slides only. Lazy photos fade in from 25% opacity for the same reason.
- **No forced layouts while hydrating.** The hero, menu showcase and reels hooks measured the page synchronously in their effects. On the prerendered page (`src/hydration.ts`: from hydration until the first client-side navigation) their `ResizeObserver`'s initial callback does it instead, still before the next paint. The reels, far down in a `content-visibility` section, wait until the visitor is within a screen of them. Pages rendered by a navigation measure at once, since the router scrolls to the target section right after rendering.
- **Background data as transitions.** Content and review responses update state inside `startTransition`, so React renders them in slices.
- **Less work at load.** The WebGL rotisserie (mesh, shaders, texture: one ~280 ms task on a throttled CPU) is built on the first scroll, touch, key or pointer input; until then the identical cutout shows. Reviews reuse one set of `Intl` formatters per language.
- **Fewer bytes before the first paint.** The `@font-face` rules are inlined into the built page; the favicon embeds a 64 px image (10 KB instead of 32 KB); logos declare their real width and share one file (256 px on phones).
- **Full menu page.** `/menu`, `/admin` and `/components` get `app.html`, the built page without the hidden prerendered home, so they no longer download the hero photo. The page preconnects to Supabase, and on `/menu` the public content requests start from the page head while the app downloads (skipped when a Supabase session is stored). Photos gained 320 px and 512 px variants and the menu cards declare their rendered width.

Remaining on `/menu`: its largest paint is a dish photo, which can only be requested after the app has run and rendered the cards, so LCP stays around 3.4 s. Prerendering `/menu` like the home page (with the app fetched at low priority) measured 88–92 in a prototype, but it needs its hydration mismatch fixed first (React error #418).

Lighthouse sometimes records the first paint about a second late on this page (compositor frames dropped, idle threads); it did so before these changes too and cannot be reproduced outside Lighthouse. Those runs are the low end of the ranges above.

# Performance improvements — 9 September 2026

The website keeps its existing layout, photos, languages, ordering links, review workflow and admin features. The changes reduce cold-load downloads and avoid unnecessary loading screens when returning to the tab.

## Measured results

Production builds served locally with Vite preview, Chromium, an empty browser cache, 1.6 Mbps download, 100 ms network latency and 4× CPU throttling. The benchmark uses French, DPR 1, and fixed menu data with mocked Supabase responses; these are laboratory measurements, not production visitor metrics. Vite preview does not reproduce the production CDN's compression or caching.

| Measurement | Before | After |
| --- | ---: | ---: |
| Main content paint (LCP), 390px viewport | 26.528 s | 2.604 s |
| Main content paint (LCP), 1440px viewport | 26.540 s | 2.648 s |
| Layout shift (CLS), 390px viewport | 0.0488 | 0.0062 |
| Layout shift (CLS), 1440px viewport | 0.1070 | 0.0013 |
| Completed resource bodies at measurement, 390px | 5.13 MB | 1.24 MB |
| Completed resource bodies at measurement, 1440px | 5.13 MB | 1.16 MB |
| Bundled photos, sum of largest delivery versions | 46.76 MB | 6.44 MB |
| Browser tab icon | 2,232,691 bytes | 31,850 bytes |

LCP improved by about 90% in this test. Resource totals are a snapshot after the hero and fonts load plus a 1.5-second observation window; they do not represent a full-page download after scrolling. Original source photographs remain available; the photo totals compare those originals with the largest generated WebP versions.

Raw measurements and viewport screenshots are in `artifacts/performance/before.json`, `after.json`, and the corresponding PNG files (local, ignored by Git).

## Changes

- Generated 81 WebP variants for 27 bundled images, with smaller selections for narrow screens. `LoadingImage` resolves existing bundled paths to these versions, including paths supplied by the content backend. External URLs, uploads, versioned URLs and explicit source sets retain their supplied sources.
- Added asynchronous image decoding, high fetch priority for the hero, and intrinsic dimensions. Kept lazy loading for menu/location images. Corrected four fallback menu image references to the existing PNG filenames.
- Compressed the existing fonts into WOFF2 containers, preserving the fonts and their glyph coverage. Made font CSS discoverable directly from the document and preloaded the main display, body and Arabic fonts.
- Created a small favicon using the same circular artwork. Gave content-hashed image variants immutable caching headers for deployment.
- Paused hero and ticker animations while they are outside the viewport.
- Preserved React data references when background requests return unchanged content, memoized public menu filtering, and combined closely spaced menu refresh notifications.
- Avoided redundant initial-session refreshes and clearing the public menu/reviews when the same signed-in user returns to the tab. Account changes and sign-out still clear old content.
- Kept the admin editor mounted during background checks of the same user's permissions. Membership is still checked on every auth event, and denied access removes the editor and dashboard.

The image-loading approach follows the browser guidance on [responsive images](https://web.dev/learn/design/responsive-images) and [LCP optimization](https://web.dev/articles/optimize-lcp). The session handling accounts for repeated sign-in notifications documented in [Supabase's auth event reference](https://supabase.com/docs/reference/javascript/auth-onauthstatechange).

## Validation

- `npm run build` — TypeScript and production build pass.
- Public browser suite — 10 tests pass, including menu filtering, ordering, calendar downloads, French/English/Arabic, mobile layouts, every generated image decoding, and animation pausing.
- Admin/review suite — all 26 scenarios pass across the full-suite and focused loading runs. Coverage includes CRUD, uploads, moderation, CAPTCHA, tab-return loading, unsaved admin drafts, and revoked membership.
- Desktop and mobile screenshots inspected against the baseline; no layout redesign.

The main JavaScript entry is approximately 548 KB uncompressed / 161 KB gzip, and Vite still reports its existing large-chunk warning. The asset lookup adds a small amount of JavaScript in exchange for much smaller image downloads. Uploaded remote photos and real production backend latency are outside this local benchmark. Deployment and live CDN-header verification remain separate from these local changes.

## Reproduce and maintain

```sh
npm run build
npm run preview -- --port 4173
# In another terminal (Node 22.18+ or 24):
node scripts/measure-performance.mjs current
```

The script writes measurements under `artifacts/performance/`. `PERFORMANCE_URL` can point to a different local preview port.

After replacing or adding a bundled photograph or changing source fonts, regenerate the delivery files before building:

```sh
python -m pip install Pillow fonttools brotli
python scripts/optimize-assets.py
npm run build
npm test
npm run test:admin
```

Commit the generated `public/assets/optimized/`, WOFF2 files, favicon, font CSS and `src/imageAssets.json` together with the code. Normal builds use these checked-in assets and do not require Python. The generator preserves original photos/fonts and creates new content-hashed image names when their optimized contents change.
