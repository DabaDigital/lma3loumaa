import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, public to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
insert into auth.users values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');`);
await db.exec(
  readFileSync(
    new URL(
      "../supabase/migrations/20260906165506_admin_content.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
await db.exec(
  readFileSync(new URL("../supabase/seed.sql", import.meta.url), "utf8"),
);
await db.exec(
  `insert into public.admin_users(user_id) values ('00000000-0000-0000-0000-000000000001');`,
);
const as = async (role, id = "") => {
  await db.exec(
    `reset role; set role ${role}; select set_config('request.jwt.claim.sub','${id}',false);`,
  );
};
const name = `' {"fr":"Test","en":"Test","ar":"اختبار"}'::jsonb`;
try {
  await as("anon");
  const initial = await db.query("select count(*)::int as n from menu_items");
  assert.ok(initial.rows[0].n > 20);
  await assert.rejects(
    db.exec(`insert into categories(id,name) values ('attack',${name})`),
    /permission denied/,
  );
  await assert.rejects(
    db.query("select * from admin_users"),
    /permission denied/,
  );
  await as("authenticated", "00000000-0000-0000-0000-000000000002");
  await assert.rejects(
    db.exec(`insert into categories(id,name) values ('attack',${name})`),
    /row-level security/,
  );
  assert.equal(
    (
      await db.query(
        `update menu_items set price=0 where id='classic' returning id`,
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (await db.query(`delete from locations returning id`)).rows.length,
    0,
  );
  await assert.rejects(
    db.exec(
      `insert into admin_users(user_id) values ('00000000-0000-0000-0000-000000000002')`,
    ),
    /permission denied/,
  );
  await as("authenticated", "00000000-0000-0000-0000-000000000001");
  for (const table of ["categories", "menu_items", "locations"]) {
    const extra =
      table === "menu_items"
        ? `,category,description,price,image`
        : table === "locations"
          ? ",area,address,image,map"
          : "";
    const values =
      table === "menu_items"
        ? `,'shawarma',${name},25,'classic'`
        : table === "locations"
          ? `,${name},${name},'/assets/maarif.png','https://maps.google.com'`
          : "";
    await db.exec(
      `insert into ${table}(id,name${extra}) values ('test-${table}',${name}${values})`,
    );
    assert.equal(
      (
        await db.query(
          `update ${table} set available=false where id='test-${table}' returning id`,
        )
      ).rows.length,
      1,
    );
    await as("anon");
    assert.equal(
      (await db.query(`select id from ${table} where id='test-${table}'`)).rows
        .length,
      0,
    );
    await as("authenticated", "00000000-0000-0000-0000-000000000001");
    assert.equal(
      (
        await db.query(
          `delete from ${table} where id='test-${table}' returning id`,
        )
      ).rows.length,
      1,
    );
  }
  await assert.rejects(
    db.exec(`delete from categories where id='shawarma'`),
    /foreign key/,
  );
  await assert.rejects(
    db.exec(`update menu_items set price=-1 where id='classic'`),
    /check constraint/,
  );
  await assert.rejects(
    db.exec(
      `update menu_items set variants='[{"name":{},"price":-1}]' where id='classic'`,
    ),
    /check constraint/,
  );
  await assert.rejects(
    db.exec(`update categories set name='{"fr":"test"}' where id='shawarma'`),
    /check constraint/,
  );
  await assert.rejects(
    db.exec(`update locations set map='javascript:alert(1)' where id='maarif'`),
    /check constraint/,
  );
  await db.exec(`update categories set available=false where id='shawarma'`);
  await as("anon");
  assert.equal(
    (await db.query(`select id from menu_items where category='shawarma'`)).rows
      .length,
    0,
  );
  await as("authenticated", "00000000-0000-0000-0000-000000000001");
  assert.ok(
    (await db.query(`select id from menu_items where category='shawarma'`)).rows
      .length > 0,
  );
  await db.exec("reset role; delete from admin_users");
  await as("authenticated", "00000000-0000-0000-0000-000000000001");
  assert.equal(
    (await db.query(`update locations set available=false returning id`)).rows
      .length,
    0,
  );
  console.log(
    "PASS: migration, seed, admin CRUD, anonymous/non-admin denial, no self-promotion, validation, category restrictions, publication filtering, and immediate admin revocation.",
  );
} finally {
  await db.close();
}
