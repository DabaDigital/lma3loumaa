# Connect the admin dashboard

The website and `/admin` share the same Supabase content tables. The code is ready; a Supabase project and initial admin account must be selected and configured before live use. No existing remote project has been modified.

1. In your chosen Supabase project's SQL Editor, run `migrations/20260906165506_admin_content.sql`. It creates `categories`, `menu_items`, `locations`, and `admin_users`, with row-level security, validation and Realtime publication membership.
2. Run `seed.sql` once to import the existing 8 categories, 24 menu entries and 2 locations. It preserves existing records on ID conflicts. `npm run seed:generate` regenerates this seed from `src/data.ts` (Node 22.13+).

   Steps 1, 2 and 5 can be done in a single paste instead. `npm run db:setup -- you@example.com` concatenates the migration, the seed and the admin grant into `supabase/setup.sql`, ready to run once in the SQL Editor. The SQL is copied verbatim from the files above, so it stays identical to what `npm run test:database` verifies. The file is gitignored because it embeds an admin email, and it is **not** re-runnable — the schema section uses plain `create table`, so a second run fails with "already exists".

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
7. Open `/admin` and sign in. Verify an edit on the public website, then run Supabase's Security Advisor for the connected project. Configure your static host to serve `index.html` for `/admin`, `/admin/items`, `/admin/categories`, `/admin/locations` and `/components`.

To revoke an admin, delete their row from `admin_users` in the trusted SQL Editor. Write access stops immediately through RLS, including for existing JWTs. Sign out/revoke their Auth sessions separately if the account itself should lose access.

## Content behavior

- Each content record has French, English and Arabic text, a display order, and a visibility toggle.
- Menu records support category selection, base and optional meal prices in DH, badges, priced variants, and existing food images or HTTPS image URLs. Locations support translated addresses, photo URLs and Google Maps links.
- Choosing **Custom image** (menu) or editing a location reveals an upload button beside the URL field. A successful upload stores the file in `menu-images` and writes its public URL into the field; the URL can still be typed or pasted instead. Type and size are checked in the browser and again by the bucket. Uploads are kept even if the form is then cancelled, so unused files accumulate in the bucket — clear them under **Storage → menu-images** when needed.
- Hiding a category hides its dishes from public reads. Deleting a category that still has dishes is blocked by a foreign key and by the dashboard; move/delete its dishes first.
- Public visitors can read visible content. Authenticated users only get write access when their Auth user ID exists in `admin_users`. Clients cannot insert or modify admin memberships.
- Realtime database events refresh website data. Focus and 30-second refreshes recover missed events. A failed request displays an error; it does not replace database content with starter records. When Supabase is not configured, the public site uses its original static menu and the admin route explains that setup is needed.
- The website does not manage Glovo's catalog. Changes here update this website only.

## Verification

```sh
npm run build
npm run test:database
npm test
npm run test:admin
```

`test:database` runs the actual migration and seed in embedded PostgreSQL and checks admin CRUD, anonymous/non-admin write denial, membership escalation denial, deletion restrictions, hidden content, input validation, and admin revocation. It does not require remote credentials.

`test:admin` runs the real Supabase JavaScript client against mocked Auth/REST/Storage responses on a separate Vite server (port 5174). It verifies UI workflows, including that a photo upload rejects the wrong type or an oversized file before any request and otherwise saves the bucket's public URL onto the dish. It is not a live Supabase integration test, so it does not cover the bucket policies in `storage.sql`. Website regressions use an isolated static-data server on port 5175. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` if needed to use an existing local Chromium installation.
