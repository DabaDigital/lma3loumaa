# PageSpeed diagnostics — 29 September 2026, evening

PageSpeed Insights on the deployed home page (commit 15a7ad4, whose build is byte-identical to production's `index-CF9xRKxx.js`) listed console errors, unused JavaScript, forced reflows, a long network chain and long tasks. Measured as in the section below: Lighthouse 13.5 mobile, local HTTP/2 + Brotli with the Vercel rules, live Supabase data, four alternating runs of each build.

| Item | Before | After |
| --- | --- | --- |
| Best Practices | 96 | 100 |
| Browser errors in the console | reviews 400 (and, on PageSpeed, realtime socket errors) | none |
| Unused JavaScript | 32 KiB flagged (`supabase-vendor`) | not flagged |
| Supabase code before first input | 54 KB compressed | 5 KB (`postgrest-vendor`) |
| Requests to Supabase during the load | 12 | 5 |
| Longest request chain, median | 1.82 s | 1.60 s |
| Layouts forced by script (trace) | 3 sources: hero frame read, menu stage and runway | 1: menu stage when it first pins |
| TBT, median | 155 ms | 83 ms |
| Performance | 96–98 | 97–99 |

What changed:

- **Supabase loads when needed.** Visitors read the public tables with `@supabase/postgrest-js` alone (`src/database.ts`): the same requests, headers and retries supabase-js makes. supabase-js itself (sign-in, realtime, storage) is imported on demand: at once on the dashboard or when a dashboard session is stored, whose reads keep the user's rights; on a visitor's first scroll, touch, key or mouse movement for the live menu channel (`src/firstInput.ts`, shared with the rotisserie); and when a review photo or the review form needs storage. Until the first input, the 30-second poll and returning to the tab keep the menu current. PageSpeed's lab browser cannot open Supabase's WebSocket, which is what logged `ERR_NAME_NOT_RESOLVED`; it never interacts, so it no longer tries. `@supabase/postgrest-js` is pinned to the version supabase-js depends on (2.115.0) so there is one copy; update both together.
- **Reviews load on approach.** The review section starts its seven requests (five per-star counts, a page, and the `detail_rank` fallback) when it comes within two screens, not during the page load. Deep links to `#reviews` still load them at once.
- **Fewer forced layouts.** The menu track's `measure()` reads the runway's top with its other reads, before writing anything (its writes change the runway's contents, not where it starts), and re-measures the stage after its writes only when they change the pin or its room. The hero's `measure()` reads its anchor there too and renders at once, instead of reading it in the next frame after hydration has changed the page.

Still listed, and why:

- **Browser errors on real visits**: production still lacks `supabase/migrations/20260928210000_review_pagination.sql` (checked: `column reviews.detail_rank does not exist`), so every visitor who reaches the reviews logs one 400 before the fallback. Run that migration in the SQL Editor.
- **Image delivery**: unchanged. Lighthouse compares the file to the photo's CSS size (380 px), while the emulated phone's 1.75× screen needs 665 px, so the 768 px hero and 512 px menu photo are the right files; smaller ones would be blurry on phones.
- **Unused CSS**: flagged only in some runs, near Lighthouse's 10 KiB threshold. The unused rules are spread over the sections below the menu (not rendered yet under `content-visibility`), modals and pickers, which the same page uses as the visitor scrolls. Splitting critical CSS would bring back a render-blocking request or late styles for measured sections.
- **Unused JavaScript in `react-vendor`** (22 KiB): parts of React DOM not run at load; it cannot be split.
- **Long tasks**: the largest is the first layout of the prerendered page (hero scene, Arabic text shaping), before any script runs.
- **Network chain**: page → app bundle → the five content tables. The menu data can only be requested once the app runs on the home page, which starts after the hero photo is painted.

# PageSpeed insights — 29 September 2026, afternoon

PageSpeed Insights on the deployed home page (commit 5887451) scored 98–99 on mobile and still listed several insights. Measured with Lighthouse 13.5 mobile (simulated throttling), headless Chromium 153 on Windows, against production builds served locally over HTTP/2 with Brotli and the `vercel.json` rewrites and headers, reading the live Supabase data. Before, the local run reproduced PageSpeed's figures exactly (474 KiB of image savings, the same stylesheet flagged).

| Item | Before | After |
| --- | --- | --- |
| Improve image delivery | 474 KiB | 67 KiB |
| Render-blocking requests | 1 stylesheet | none |
| LCP, 3 or 4 runs | 1.95 s, or 5.1 s in 2 of 3 runs | 1.73 s in all 4 |
| Label content name mismatch, identical links | failing | passing |
| Clickjacking, cross-origin opener | no headers | passing |

What changed:

- **Photos.** `scripts/optimize-assets.py` encodes WebP at quality 75 with lossy alpha (60), which is about Lighthouse's 1/6 byte per pixel; at drawn sizes it looks the same as quality 86 with lossless alpha and is a third smaller. The hero photo is 53 KB instead of 88 KB. The script now removes outputs no longer referenced.
- **Hero cutouts** go through the same pipeline. The rotisserie cutout on screen is 192–512 px wide by screen (11 KB on phones, was 105 KB). Its WebGL model still loads the 512 px file as a texture when it is built, since the lathe magnifies the middle of the photo. The reveal layers (175 KB, was 243 KB) stay `visibility: hidden` until scrolling opens them, so the page load no longer paints them, and are decoded before the scene counts as ready.
- **Showcase `sizes`.** The carousel frame has a fixed height, so a square dish photo is drawn about 275 px wide on phones, not 92vw. Supabase-resized photos gained a 512 px step.
- **Stylesheet in the home page.** `scripts/prerender.mjs` puts the built CSS inside `index.html` (about 19 KB with Brotli). Over HTTP/2 the first paint is unchanged (1.2 s) and no request blocks it. `app.html` keeps the link.
- **App start.** The prerendered page starts the app once Element Timing reports the hero photo on screen (`elementtiming="hero"`), instead of after two animation frames. In headless Chrome the GPU can hold the first frame back by a second, and when the app started first, Lighthouse counted its download toward LCP.
- **Accessibility.** The language button's name now starts with its visible code ("FR Langue"). Each reel's "see the post" link and each location's directions link names its post or location.
- **Headers.** All responses send `Cross-Origin-Opener-Policy: same-origin`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` and a CSP limited to `frame-ancestors 'none'; object-src 'none'; base-uri 'none'`.

Still listed, and why:

- **Browser errors in the console** (Best Practices 96): production has not applied `supabase/migrations/20260928210000_review_pagination.sql`, so the first reviews request (ordered by `detail_rank`) returns 400 before the fallback. Run that migration in the SQL Editor.
- **Image delivery, 67 KiB**: the hero photo and the first showcase photo. This Lighthouse compares files against CSS pixels, not the emulated phone's 1.75× screen, so photos that are sharp on that phone still count as oversized.
- **Network dependency tree**: the fonts the inline CSS asks for, and the app bundle, which starts after the page is painted. Preloading fonts would waste them on French and English visits.
- **Unused JavaScript**: mostly `@supabase/supabase-js`, whose auth, realtime and storage clients the public page uses after load. Replacing it with smaller clients is a separate change.
- **CSP against XSS and Trusted Types**: a `script-src` policy needs per-build hashes of the three inline bootstrap scripts, plus Turnstile's loader. Not done here.

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
