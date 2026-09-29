# Shawarma Lma3louma

A responsive, trilingual restaurant website for Shawarma Lma3louma (Casablanca), in the restaurant's teal, gold and cream palette. React 19 + TypeScript on Vite, with a Supabase-backed admin dashboard, moderated guest reviews and a CAPTCHA-protected submission API deployed as a Vercel function.

- Public site: menu, locations, ordering handoff, visit planner, guest reviews
- `/admin`: Supabase-authenticated dashboard for categories, menu, locations and review moderation
- `/components`: reusable component gallery

## Quick start

Requires Node 22.13 or newer.

```sh
npm install
cp .env.example .env.local   # then fill in the Supabase values
npm run dev
```

Open http://127.0.0.1:5173.

Without Supabase configured, the public site falls back to the static menu in `src/data.ts` and `/admin` explains that setup is needed. To connect a database, follow the [Supabase setup guide](supabase/README.md).

```sh
npm run build     # tsc -b, then vite build into dist/
npm run preview
```

## Environment variables

Copy `.env.example` to `.env.local` (both `.env.local` and `.env` are gitignored).

| Variable | Scope | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Browser | Supabase project API URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser | Supabase **publishable** key |
| `TURNSTILE_SITE_KEY` | Server | Public Cloudflare Turnstile site key |
| `TURNSTILE_SECRET_KEY` | Server | Matching Turnstile secret key |
| `SUPABASE_SECRET_KEY` | Server | Supabase secret key used by the review API |
| `REVIEW_ALLOWED_HOSTNAMES` | Server | Comma-separated hostnames allowed to submit reviews |
| `REVIEW_RATE_LIMIT_SECRET` | Server | Optional stable secret for hashing network addresses |

Never give a secret key a `VITE_` prefix — Vite inlines those into the browser bundle. `npm run check:reviews` validates the review configuration structure and prints setting names only, never values.

In development, `vite.config.ts` mounts the same review handler as local middleware at `/api/reviews`, so the submission flow can be exercised without deploying.

## Features

**Languages and content**
- French, English and Arabic with full RTL layout, localized menu data and a saved language preference.
- Search across all three menu languages, category filters, price sorting, meal toggle and priced variations.
- Website copy lives in `src/i18n.ts`; dashboard copy in `src/admin/copy.ts`; review copy in `src/reviewCopy.ts`.

**Ordering and locations**
- Direct restaurant handoff to Glovo. No mock checkout or fictional order confirmation.
- Both Casablanca locations with the supplied Google Maps links.
- Visit planner that downloads a personal `.ics` calendar file.

**Guest reviews**
- Visitors submit a title (up to 100 characters) and 1–5 stars, with an optional description (up to 1500 characters) and a JPEG/PNG/WebP photo up to 5 MB. No visitor account required.
- Every submission starts as `pending` and is invisible until an admin approves it. Guests cannot set a status, edit, delete, or read pending and rejected submissions.
- Cloudflare Turnstile plus per-address daily quotas, enforced server-side in `api/reviews.js`. Photos land in a **private** bucket and are served through RLS-checked downloads, so an unapproved photo cannot be fetched even with its exact path.
- The review form and CAPTCHA integration load on demand, not in the main bundle.

**Admin dashboard**
- Branded `/admin` with Supabase authentication and category, menu, location and review management in all three languages, plus the Instagram, Facebook, Glovo and Klit links shown on the home page.
- Admin access is granted only by inserting a row into `admin_users` from the trusted SQL Editor; there is no public sign-up or automatic enrollment. Revoking a row stops write access immediately through RLS.

**Accessibility and performance**
- Native modal dialogs with keyboard dismissal and focus restoration.
- Reduced-motion support, manual animation control, and animations paused while off-screen.
- Self-hosted WOFF2 fonts, responsive WebP image variants, content-hashed immutable caching. No analytics or tracking cookies of its own. Posts added to the follow-us section load Instagram's, Facebook's or TikTok's official players when they come into view, and those providers may set their own cookies.
- Reusable Button, Input, SelectInput, Dropdown, DatePicker and Toggle components in `src/components.tsx`.

See [performance notes](docs/performance.md) for measurements, the chunk-splitting setup and the asset regeneration workflow.

## Project structure

```
api/reviews.js        Vercel function: Turnstile verification, quotas, scoped uploads
server/review-config.js  Shared configuration validation for the review API
src/                  Public website (App.tsx, data.ts, i18n.ts, reviews.ts, styles)
src/admin/            Dashboard (Admin.tsx, Editor.tsx, ReviewsAdmin.tsx, copy.ts)
supabase/             Migrations, seed, storage and review-protection SQL
scripts/              Seed generation, setup SQL builder, config check, asset tooling
tests/                Playwright specs and embedded-PostgreSQL database suites
docs/                 Performance notes and review-protection activation guide
public/assets/        Photos, generated WebP variants, self-hosted fonts, logo
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on 127.0.0.1, with the local review API |
| `npm run build` | TypeScript project build, then production bundle into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Playwright suite for the public website |
| `npm run test:admin` | Admin/review suite against mocked Supabase responses |
| `npm run test:production` | Exercise the compiled build with the mocked backend |
| `npm run test:database` | Replay migrations and seed in embedded PostgreSQL |
| `npm run test:reviews:database` | Review RLS, moderation and storage policy checks |
| `npm run test:reviews:protection` | Review API and protected-submission database checks |
| `npm run check:reviews` | Validate review environment configuration |
| `npm run seed:generate` | Regenerate `supabase/seed.sql` from `src/data.ts` |
| `npm run db:setup -- you@example.com` | Build a single-paste `supabase/setup.sql` for a fresh project |

## Testing

```sh
npx playwright install chromium
npm test
npm run test:admin
```

If Chromium is already installed elsewhere, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its executable path first.

Coverage spans menu filtering, price changes, variant selection, Glovo handoff links, French/English/Arabic persistence, RTL, mobile navigation, calendar download, review submission and CAPTCHA, admin CRUD and uploads, moderation, revoked membership, runtime errors, and horizontal overflow at 320, 390, 768 and 1440 pixels. The database suites run real migrations in embedded PostgreSQL and need no remote credentials. `test:admin` and `test:production` use mocked Supabase responses — they are not live integration tests, so bucket policies in `storage.sql` remain unverified by them.

## Deploy

`vercel.json` configures the Vite build, immutable caching for `/assets/optimized/*`, and rewrites so `/admin/*` and `/components` resolve on direct navigation. On another static host, serve `index.html` for `/admin`, `/admin/items`, `/admin/categories`, `/admin/locations`, `/admin/links`, `/admin/reviews` and `/components`.

The review API must be deployed on Vercel — it depends on the `x-vercel-forwarded-for` header for the visitor identity and refuses to run otherwise.

Before publishing the review feature, work through [CAPTCHA activation and deployment](docs/review-protection.md): set the production environment variables, apply `supabase/review-protection.sql`, and **redeploy** (saving Vercel environment variables does not update an existing deployment).

## Content and integration notes

Menu prices were transcribed from the nine menu screenshots supplied by the restaurant. Variations are grouped together in the product dialog. The Trio Mezzés price appears as 40 DH behind an Instagram overlay; confirm it with the restaurant before publishing. Descriptions are editorial copy and are **not** complete ingredient or allergen declarations — verify them before launch. Food photographs may show accompaniments that are sold separately. Arabic copy should get a final review by the restaurant before publication.

`src/data.ts` holds the initial menu, location links and Glovo URL. When Supabase is configured, it supplies the live categories, menu and locations instead; Realtime events plus focus and 30-second refreshes keep the site current, and a failed request shows an error rather than reverting to starter data.

The restaurant's public Glovo destination was verified on 6 September 2026:
https://glovoapp.com/en/ma/casablanca/stores/shawarma-lma3louma-cas

Glovo handles address coverage, branch routing, live prices, availability, checkout and delivery. Selections made on this website **do not transfer to a Glovo basket**, which is disclosed in the product dialogs. No order API or merchant credentials were provided, and this site does not manage Glovo's catalog. The visit planner creates a personal `.ics` file only — it does not make a reservation or contact the restaurant.

## Assets

The site uses the restaurant's supplied photographs, displayed with CSS viewport crops, and the original transparent logo at `public/assets/lma3louma-logo.png`, shown intact in the header, footer and browser icon. Source files are unchanged. Replace the menu screenshots with original high-resolution photography when available — screenshot sources limit food image fidelity. None of the current imagery is AI-generated.

Fonts: Titan One (French and English), Barlow Condensed, DM Sans and Noto Sans Arabic, downloaded from Google Fonts and served locally. Source stylesheet: `public/assets/fonts-source.css`; license files under `public/assets/fonts`.

Regenerating delivery assets after replacing a photo or font requires Python:

```sh
python -m pip install Pillow fonttools brotli
python scripts/optimize-assets.py
```

Commit the generated `public/assets/optimized/`, WOFF2 files, favicon, font CSS and `src/imageAssets.json` alongside the code. Normal builds use these checked-in assets and do not need Python.
