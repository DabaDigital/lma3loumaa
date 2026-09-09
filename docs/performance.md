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
