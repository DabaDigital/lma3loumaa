# Connect the admin dashboard

The website and `/admin` share the same Supabase content tables. The configured project already has an admin account. The guest review migration and private review photo storage were applied to that project on 2026-09-08. The steps below are for setting up another project; do not re-run the full setup on the configured database.

1. In your chosen Supabase project's SQL Editor, run each file in `migrations/` in filename order. They create `categories`, `menu_items`, `locations`, `admin_users` and `reviews`, with row-level security and validation. Content tables also use Realtime publication membership; reviews use periodic/focus refreshes.
2. Run `seed.sql` once to import the existing 8 categories, 24 menu entries and 2 locations. It preserves existing records on ID conflicts. `npm run seed:generate` regenerates this seed from `src/data.ts` (Node 22.13+).

   Steps 1, 2 and 5 plus the private review image bucket can be done in a single paste instead. `npm run db:setup -- you@example.com` concatenates the migrations, `review-storage.sql`, the seed and the admin grant into `supabase/setup.sql`, ready to run once in the SQL Editor. SQL is copied verbatim from the files covered by the database test scripts. The file is gitignored because it embeds an admin email, and it is **not** re-runnable — the schema section uses plain `create table`, so a second run fails with "already exists".

3. Copy `.env.example` to `.env.local` (a plain `.env` works too; both are gitignored). Set `VITE_SUPABASE_URL` to the project's API URL and `VITE_SUPABASE_PUBLISHABLE_KEY` to its **publishable** key. Never put a secret/service-role key in a Vite variable. Restart the development server after changing these values. Set the same variables on your hosting provider before building.
4. In Supabase **Authentication → Users → Add user → Create new user**, create the intended administrator with their email and a strong password. Confirm the email there if appropriate. The website deliberately has no public sign-up or automatic admin enrollment.
5. In the SQL Editor, grant that existing Auth user membership by replacing the email below:

```sql
insert into public.admin_users (user_id)
select id from auth.users where lower(email) = lower('YOUR_ADMIN_EMAIL')
on conflict (user_id) do nothing;

-- Verify that exactly the intended account was granted membership.
select u.email, a.created_at
from public.admin_users a join auth.users u on u.id = a.user_id;
```

6. To enable photo uploads in the dashboard, run `storage.sql` in the SQL Editor. It creates the public `menu-images` bucket (5 MB, JPEG/PNG/WebP/AVIF) and restricts writes to `admin_users`, the same membership check the content tables use. This file is re-runnable and deliberately sits outside `migrations/`: it touches the platform `storage` schema, which only exists on a real Supabase project, while `npm run test:database` replays `migrations/` in plain PostgreSQL. Skip this step to keep image URLs typed by hand.
7. Run `review-storage.sql` to enable visitor review photos, unless you used the generated setup file. It creates the **private** `review-images` bucket and its moderation-aware policies. Run `migrations/20260907153833_guest_reviews.sql` first. For an existing deployment, apply only that new migration and this storage file; do not re-run the full setup or original content migration.
8. Open `/admin` and sign in. Verify an edit on the public website, then run Supabase's Security Advisor for the connected project. Configure your static host to serve `index.html` for `/admin`, `/admin/items`, `/admin/categories`, `/admin/locations`, `/admin/reviews` and `/components`.

To revoke an admin, delete their row from `admin_users` in the trusted SQL Editor. Write access stops immediately through RLS, including for existing JWTs. Sign out/revoke their Auth sessions separately if the account itself should lose access.

## Content behavior

- Each content record has French, English and Arabic text, a display order, and a visibility toggle.
- Menu records support category selection, base and optional meal prices in DH, badges, priced variants, and existing food images or HTTPS image URLs. Locations support translated addresses, photo URLs and Google Maps links.
- Choosing **Custom image** (menu) or editing a location reveals an upload button beside the URL field. A successful upload stores the file in `menu-images` and writes its public URL into the field; the URL can still be typed or pasted instead. Type and size are checked in the browser and again by the bucket. Uploads are kept even if the form is then cancelled, so unused files accumulate in the bucket — clear them under **Storage → menu-images** when needed.
- Hiding a category hides its dishes from public reads. Deleting a category that still has dishes is blocked by a foreign key and by the dashboard; move/delete its dishes first.
- Public visitors can read visible content. Authenticated users only get write access when their Auth user ID exists in `admin_users`. Clients cannot insert or modify admin memberships.
- Realtime database events refresh website data. Focus and 30-second refreshes recover missed events. A failed request displays an error; it does not replace database content with starter records. When Supabase is not configured, the public site uses its original static menu and the admin route explains that setup is needed.
- The website does not manage Glovo's catalog. Changes here update this website only.

## Guest reviews and moderation

- Visitors must provide a non-empty title (up to 100 characters) and 1–5 stars. A description (up to 1500 characters) and a JPEG, PNG or WebP photo up to 5 MB are optional. No visitor account is needed. Text is trimmed before submission. The database validates text lengths, rating and photo path independently of the form. Existing deployments also need `migrations/20260908134114_optional_review_description.sql` to allow blank or short descriptions and short titles; this migration was applied to the configured project on 2026-09-08.
- Every submission starts as `pending`. Guests cannot supply a status, creation date or moderation date, edit a submission, delete it, or read pending/rejected submissions. Authenticated non-admin users have the same public visibility. Only accounts already in `admin_users` can see the moderation queue or approve/reject reviews. Moderator actions change the status and a server-controlled `moderated_at` timestamp; the original text, photo path and rating remain immutable through the browser API.
- Review photos are uploaded first to `review-images/<new UUID>/photo.jpg`, `photo.png` or `photo.webp` with `upsert: false`. A matching review ID and a unique path bind the review to its photo. Guest policies permit creating a new object only, preventing replacement or deletion of existing photos. A pending or unlinked photo cannot be downloaded publicly, even by someone who knows its exact path.
- Approval requires the linked photo to exist. Guests cannot upload new files under an approved review's UUID, including after an admin removes its photo. Reviews without a photo can still be approved.
- Public photo loading uses the Storage `download` API with RLS checks. Do not make the bucket public or substitute `getPublicUrl`/long-lived signed URLs: doing so would defeat moderation privacy or delay revocation. Approval publishes both the review and its linked photo; rejection hides the review and denies subsequent photo downloads. A browser may retain a photo it downloaded while the review was approved.
- A failed/cancelled submission can leave an unlinked private photo. Admins should periodically remove unused or rejected photos under **Storage → review-images**, through the dashboard or Storage API, after checking `reviews.image_path`. Do not delete Storage object metadata directly with SQL. Guest uploads are intentionally not allowed to delete files.
- The schema is separate from `review-storage.sql` because the latter uses Supabase's platform schema. The combined setup script includes both for a fresh Supabase project. Reviews are not added to Realtime; public and admin lists recover changes through polling/focus refreshes.

## Verification

The connected project's review RLS, moderation policies and private 5 MB JPEG/PNG/WebP bucket were verified after applying the migration. No sample reviews were saved. Role-switching integration checks are unavailable through this project's SQL connection, so permission and moderation scenarios are covered by the embedded PostgreSQL suite below. The Security Advisor reported no review-schema findings; its existing Auth notice concerns [leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

```sh
npm run build
npm run test:database
npm run test:reviews:database
npm test
npm run test:admin
```

`test:database` runs the actual migration and seed in embedded PostgreSQL and checks admin CRUD, anonymous/non-admin write denial, membership escalation denial, deletion restrictions, hidden content, input validation, and admin revocation. It does not require remote credentials.

`test:reviews:database` replays all migrations and the actual `review-storage.sql` policies against embedded PostgreSQL with minimal Storage tables. It checks guest submission, immutable fields, validation, pending/rejected review and photo privacy, admin approval/rejection, immediate admin revocation, orphan cleanup and guest overwrite/delete denial. It verifies the configured bucket MIME/size limits; the real Supabase upload service enforces those limits, so HTTP file validation still requires a live integration check.

`test:admin` runs the real Supabase JavaScript client against mocked Auth/REST/Storage responses on a separate Vite server (port 5174). It verifies UI workflows, including that a photo upload rejects the wrong type or an oversized file before any request and otherwise saves the bucket's public URL onto the dish. It is not a live Supabase integration test, so it does not cover the bucket policies in `storage.sql`. Website regressions use an isolated static-data server on port 5175. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` if needed to use an existing local Chromium installation.
