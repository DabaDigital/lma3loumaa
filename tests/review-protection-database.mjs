import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
const db = new PGlite();
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const source = "a".repeat(64),
  other = "b".repeat(64);
const ids = [1, 2, 3, 4, 5, 6].map(
  (n) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
);
const run = async (query, values = []) => (await db.query(query, values)).rows;
const reserve = (id, hash = source, photo = null) =>
  run(
    "select public.prepare_guest_review($1,$2,$3,$4,$5::smallint,$6) as result",
    [id, hash, "A", "", 5, photo],
  );
const finish = (id, hash = source) =>
  run("select public.complete_guest_review($1,$2) as result", [id, hash]);
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  for (const file of readdirSync(
    new URL("../supabase/migrations/", import.meta.url),
  )
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(read(`../supabase/migrations/${file}`));
  await db.exec(`create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated, service_role;
    grant all on storage.objects,storage.buckets to service_role;
    grant select,insert,update,delete on storage.objects to anon,authenticated;
  `);
  await db.exec(read("../supabase/review-storage.sql"));
  await db.exec(read("../supabase/review-protection.sql"));
  await db.exec(read("../supabase/review-protection.sql"));
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    await assert.rejects(reserve(ids[0]), /permission denied/);
    await assert.rejects(finish(ids[0]), /permission denied/);
    await assert.rejects(
      run("select * from private.review_submissions"),
      /permission denied/,
    );
    await assert.rejects(
      run("insert into public.reviews(id,title,rating) values ($1,$2,$3)", [
        ids[0],
        "A",
        5,
      ]),
      /permission denied/,
    );
    for (const bucket of ["review-images", "review-uploads"])
      await assert.rejects(
        run("insert into storage.objects(bucket_id,name) values ($1,$2)", [
          bucket,
          `${ids[0]}/photo.png`,
        ]),
        /row-level security/,
      );
    await db.exec("reset role");
  }
  await db.exec("set role service_role");
  await reserve(ids[0]);
  await reserve(ids[1]);
  await assert.rejects(reserve(ids[2]), /REVIEW_DAILY_LIMIT/);
  await finish(ids[0]);
  await finish(ids[1]);
  await finish(ids[0]);
  assert.equal(
    (await run("select count(*)::int as n from public.reviews"))[0].n,
    2,
    "retries cannot create duplicates",
  );
  await assert.rejects(reserve(ids[2]), /REVIEW_DAILY_LIMIT/);
  await assert.rejects(finish(ids[0], other), /REVIEW_EXPIRED/);
  await assert.rejects(reserve(ids[0], other), /REVIEW_CONFLICT/);
  await assert.rejects(
    run("select public.prepare_guest_review($1,$2,$3,$4,$5::smallint,$6)", [
      ids[0],
      source,
      "Changed",
      "",
      5,
      null,
    ]),
    /REVIEW_CONFLICT/,
  );
  // Day assignment is made by PostgreSQL, using Casablanca's calendar.
  assert.equal(
    (
      await run(
        "select bool_and(day = (now() at time zone 'Africa/Casablanca')::date) as correct from private.review_submissions",
      )
    )[0].correct,
    true,
  );
  await run(
    "update private.review_submissions set day = day - 1 where source_hash=$1",
    [source],
  );
  await reserve(ids[2]);
  await finish(ids[2]);
  await reserve(ids[3]);
  await run(
    "update private.review_submissions set expires_at=now()-interval '1 minute' where id=$1",
    [ids[3]],
  );
  await assert.rejects(finish(ids[3]), /REVIEW_EXPIRED/);
  await reserve(ids[4]); // Expired/abandoned reservations free their slot.
  await finish(ids[4]);
  await assert.rejects(reserve(ids[5]), /REVIEW_DAILY_LIMIT/);
  const photo = `${ids[5]}/photo.png`;
  await reserve(ids[5], other, photo);
  await assert.rejects(finish(ids[5], other), /REVIEW_PHOTO_MISSING/);
  await run("insert into storage.objects(bucket_id,name) values ($1,$2)", [
    "review-uploads",
    photo,
  ]);
  await assert.rejects(
    finish(ids[5], other),
    /REVIEW_PHOTO_MISSING/,
    "staging is never publishable",
  );
  await run(
    "update storage.objects set bucket_id='review-images' where name=$1",
    [photo],
  );
  await finish(ids[5], other);
  assert.equal(
    (await run("select status from public.reviews where id=$1", [ids[5]]))[0]
      .status,
    "pending",
  );
  await db.exec("reset role; set role anon");
  assert.equal(
    (await run("select * from public.reviews")).length,
    0,
    "CAPTCHA does not bypass admin moderation",
  );
  console.log(
    "PASS: private quota ledger, two per Casablanca day, reservation expiry, idempotency, binding, photo staging, direct-write denial, and pending privacy.",
  );
} finally {
  await db.close();
}
