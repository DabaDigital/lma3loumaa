import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";

const db = new PGlite();
const sql = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const admin = "00000000-0000-0000-0000-000000000001";
const visitor = "00000000-0000-0000-0000-000000000002";
const review = "10000000-0000-4000-8000-000000000001";
const orphan = "10000000-0000-4000-8000-000000000002";
const textOnly = "10000000-0000-4000-8000-000000000003";
const rejectedInput = "10000000-0000-4000-8000-000000000004";
const missingPhoto = "10000000-0000-4000-8000-000000000005";

const as = async (role, id = "") => {
  await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.sub','${id}',false)`);
};
const rows = async (query) => (await db.query(query)).rows;
const photo = (id, ext = "png") => `${id}/photo.${ext}`;
const insertReview = (id, image = null) => db.query(
  "insert into public.reviews(id,title,description,rating,image_path) values ($1,$2,$3,$4,$5)",
  [id, "Lovely shawarma", "Fresh food and a very generous portion.", 5, image],
);
const upload = (name, bucket = "review-images") => db.query(
  "insert into storage.objects(bucket_id,name) values ($1,$2)", [bucket, name],
);

try {
  await db.exec(`
    create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    insert into auth.users values ('${admin}'), ('${visitor}');
  `);
  for (const migration of readdirSync(new URL("../supabase/migrations/", import.meta.url)).filter((name) => name.endsWith(".sql")).sort()) {
    await db.exec(sql(`../supabase/migrations/${migration}`));
  }
  await db.exec(`insert into public.admin_users(user_id) values ('${admin}')`);

  // Model the platform tables and grants, then execute the actual Storage SQL.
  // This exercises PostgreSQL RLS. Supabase's HTTP upload service enforces
  // file_size_limit / allowed_mime_types; their configured values are checked below.
  await db.exec(`
    create schema storage;
    create table storage.buckets (
      id text primary key, name text not null, public boolean not null,
      file_size_limit bigint, allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text not null references storage.buckets(id), name text not null,
      unique(bucket_id,name)
    );
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated;
    grant select, insert, update, delete on storage.objects to anon, authenticated;
  `);
  await db.exec(sql("../supabase/review-storage.sql"));
  await db.exec(sql("../supabase/review-storage.sql"));
  const [bucket] = await rows("select * from storage.buckets where id='review-images'");
  assert.equal(bucket.public, false);
  assert.equal(Number(bucket.file_size_limit), 5 * 1024 * 1024);
  assert.deepEqual(bucket.allowed_mime_types, ["image/jpeg", "image/png", "image/webp"]);

  await as("anon");
  await upload(photo(review));
  await upload(photo(orphan));
  assert.equal((await rows("select * from storage.objects")).length, 0, "unlinked images stay private");
  await insertReview(review, photo(review));
  await db.query("insert into public.reviews(id,title,rating) values ($1,$2,$3)", [textOnly, "A", 5]);
  await db.exec("begin");
  await db.query("insert into public.reviews(id,title,description,rating) values ($1,$2,$3,$4)", [rejectedInput, "Good", "good", 5]);
  await db.exec("rollback");
  assert.equal((await rows("select * from public.reviews")).length, 0, "pending reviews stay private");
  assert.equal((await rows(`select * from storage.objects where name='${photo(review)}'`)).length, 0, "knowing the pending path does not grant access");

  await assert.rejects(db.exec(`insert into public.reviews(id,title,description,rating,status) values ('${rejectedInput}','Test title','Long enough description',5,'approved')`), /permission denied/);
  await assert.rejects(db.exec(`insert into public.reviews(id,title,description,rating,status) values ('${rejectedInput}','Test title','Long enough description',5,'pending')`), /permission denied/, "even the default status must be server supplied");
  await assert.rejects(db.exec(`insert into public.reviews(id,title,description,rating,created_at) values ('${rejectedInput}','Test title','Long enough description',5,'2020-01-01')`), /permission denied/);
  await assert.rejects(db.exec(`insert into public.reviews(id,title,description,rating,moderated_at) values ('${rejectedInput}','Test title','Long enough description',5,now())`), /permission denied/);
  await assert.rejects(db.exec(`update public.reviews set status='approved' where id='${review}'`), /permission denied/);
  await assert.rejects(db.exec("delete from public.reviews"), /permission denied/);
  await assert.rejects(db.exec(`insert into public.reviews(id,title,description,rating) values ('${rejectedInput}','Test title','Long enough description',5) returning id`), /row-level security/, "the client must not request RETURNING on its private pending insert");

  for (const [title, description, rating, image] of [
    ["", "Long enough description", 5, null],
    [" ".repeat(3), "Long enough description", 5, null],
    [" x ", "Long enough description", 5, null],
    ["\tUntrimmed title\n", "Long enough description", 5, null],
    ["x".repeat(101), "Long enough description", 5, null],
    ["Test title", "\nUntrimmed description\t", 5, null],
    ["Test title", "x".repeat(1501), 5, null],
    ["Test title", "Long enough description", 0, null],
    ["Test title", "Long enough description", 6, null],
    ["Test title", "Long enough description", 5, photo(review)],
    ["Test title", "Long enough description", 5, `${rejectedInput}/photo.svg`],
    ["Test title", "Long enough description", 5, `https://example.com/image.png`],
  ]) {
    await assert.rejects(db.query(
      "insert into public.reviews(id,title,description,rating,image_path) values ($1,$2,$3,$4,$5)",
      [rejectedInput, title, description, rating, image],
    ), /check constraint/);
  }
  for (const name of ["photo.png", `other/${photo(review)}`, `${review}/photo.svg`, `${review}/another.png`, `../${photo(review)}`]) {
    await assert.rejects(upload(name), /row-level security/);
  }
  await assert.rejects(upload(photo(rejectedInput), "other-bucket"), /row-level security/);
  await assert.rejects(db.exec(`insert into storage.objects(bucket_id,name) values ('review-images','${photo(review)}') on conflict(bucket_id,name) do update set name=excluded.name`), /row-level security/);
  assert.equal((await rows(`update storage.objects set name='${review}/photo.webp' where name='${photo(review)}' returning id`)).length, 0);
  assert.equal((await rows(`delete from storage.objects where name='${photo(review)}' returning id`)).length, 0);

  await as("authenticated", visitor);
  assert.equal((await rows("select * from public.reviews")).length, 0);
  assert.equal((await rows(`update public.reviews set status='approved' where id='${review}' returning id`)).length, 0);
  assert.equal((await rows("select * from storage.objects")).length, 0);
  await assert.rejects(db.exec(`insert into public.admin_users(user_id) values ('${visitor}')`), /permission denied/);
  await assert.rejects(db.exec(`update public.reviews set title='Hijacked title' where id='${review}'`), /permission denied/);

  await as("authenticated", admin);
  const pending = await rows("select * from public.reviews order by id");
  assert.equal(pending.length, 2);
  assert.equal(pending[0].status, "pending");
  assert.equal(pending[0].moderated_at, null);
  assert.ok(pending[0].created_at instanceof Date);
  assert.equal((await rows("select * from storage.objects")).length, 2, "admins can moderate pending and orphan images");
  await assert.rejects(db.exec(`update public.reviews set title='Changed original' where id='${review}'`), /permission denied/);
  await assert.rejects(db.exec(`update public.reviews set description='Changed original description' where id='${review}'`), /permission denied/);
  await assert.rejects(db.exec(`update public.reviews set rating=1 where id='${review}'`), /permission denied/);
  await assert.rejects(db.exec(`update public.reviews set image_path=null where id='${review}'`), /permission denied/);
  await assert.rejects(db.exec(`update public.reviews set id='${orphan}' where id='${review}'`), /permission denied/);
  await assert.rejects(db.exec(`update public.reviews set created_at='2020-01-01' where id='${review}'`), /permission denied/);
  await assert.rejects(db.exec(`update public.reviews set moderated_at='2020-01-01' where id='${review}'`), /permission denied/);
  await assert.rejects(db.exec(`delete from public.reviews where id='${review}'`), /permission denied/);
  await assert.rejects(db.exec(`update public.reviews set status='unknown' where id='${review}'`), /check constraint/);
  let [moderated] = await rows(`update public.reviews set status='approved' where id='${review}' returning id,status,moderated_at`);
  assert.equal(moderated.status, "approved");
  assert.ok(moderated.moderated_at instanceof Date);
  const [unchanged] = await rows(`update public.reviews set status='approved' where id='${review}' returning moderated_at`);
  assert.equal(unchanged.moderated_at.getTime(), moderated.moderated_at.getTime(), "an unchanged status preserves its moderation date");

  await as("anon");
  assert.deepEqual((await rows("select id from public.reviews")).map((row) => row.id), [review]);
  assert.deepEqual((await rows("select name from storage.objects")).map((row) => row.name), [photo(review)]);
  await assert.rejects(insertReview(review, photo(review)), /duplicate key/);
  assert.equal((await rows(`update storage.objects set name='${review}/photo.webp' where name='${photo(review)}' returning id`)).length, 0, "published photos still cannot be changed by guests");
  assert.equal((await rows(`delete from storage.objects where name='${photo(review)}' returning id`)).length, 0);

  await as("authenticated", admin);
  [moderated] = await rows(`update public.reviews set status='rejected' where id='${review}' returning status`);
  assert.equal(moderated.status, "rejected");
  await as("anon");
  assert.equal((await rows("select * from public.reviews")).length, 0);
  assert.equal((await rows(`select * from storage.objects where name='${photo(review)}'`)).length, 0, "rejection revokes direct photo reads");
  await as("authenticated", visitor);
  assert.equal((await rows("select * from public.reviews")).length, 0);
  assert.equal((await rows("select * from storage.objects")).length, 0);

  await as("authenticated", admin);
  assert.equal((await rows(`delete from storage.objects where name='${photo(orphan)}' returning id`)).length, 1);
  // A missing photo cannot be approved, and a published path cannot accept a
  // replacement if an administrator subsequently removes its original object.
  await insertReview(missingPhoto, photo(missingPhoto));
  await assert.rejects(db.exec(`update public.reviews set status='approved' where id='${missingPhoto}'`), /photo must exist before approval/, "photo approval requires a committed Storage object");
  assert.equal((await rows(`select status from public.reviews where id='${missingPhoto}'`))[0].status, "pending");
  await as("anon");
  await upload(photo(missingPhoto));
  await as("authenticated", admin);
  await db.exec(`update public.reviews set status='approved' where id='${missingPhoto}'`);
  assert.equal((await rows(`delete from storage.objects where name='${photo(missingPhoto)}' returning id`)).length, 1);
  await db.exec(`update public.reviews set status='approved' where id='${review}'`);
  assert.equal((await rows(`delete from storage.objects where name='${photo(review)}' returning id`)).length, 1);
  await assert.rejects(db.exec(`update public.reviews set status='approved' where id='${review}'`), /photo must exist before approval/, "approval cannot be refreshed after its photo is removed");
  await db.exec(`update public.reviews set status='approved' where id='${textOnly}'`);
  assert.equal((await rows(`select status from public.reviews where id='${textOnly}'`))[0].status, "approved", "text-only reviews can still be approved");
  await db.exec(`update public.reviews set status='rejected' where id='${textOnly}'`);
  await as("anon");
  await assert.rejects(upload(photo(missingPhoto)), /row-level security/, "guests cannot fill a missing approved photo");
  await assert.rejects(upload(photo(review)), /row-level security/, "guests cannot replace a deleted approved photo");
  await assert.rejects(upload(photo(review, "webp")), /row-level security/, "an approved review UUID cannot receive another photo extension");
  await as("authenticated", visitor);
  await assert.rejects(upload(photo(missingPhoto)), /row-level security/, "signed-in visitors cannot fill an approved photo either");
  await as("authenticated", admin);
  await db.exec(`update public.reviews set status='rejected' where id='${missingPhoto}'`);
  await db.exec(`update public.reviews set status='pending' where id='${review}'`);
  assert.equal((await rows(`select moderated_at from public.reviews where id='${review}'`))[0].moderated_at, null);
  await db.exec("reset role; delete from public.admin_users");
  await as("authenticated", admin);
  assert.equal((await rows("select * from public.reviews")).length, 0);
  assert.equal((await rows("select * from storage.objects")).length, 0);
  assert.equal((await rows(`update public.reviews set status='approved' where id='${review}' returning id`)).length, 0, "revocation applies to an existing session");

  console.log("PASS: guest submissions, immutable content/server fields, validation, pending privacy, admin approval/rejection/revocation, private photo RLS, upload path checks, no late approved uploads or guest overwrite/delete, orphan cleanup, and bucket limits.");
} finally {
  await db.close();
}
