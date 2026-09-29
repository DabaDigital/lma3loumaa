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
  readFileSync(
    new URL(
      "../supabase/migrations/20260928190000_site_links.sql",
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
  // Links saved before the open-list migration carry over; empty ones go.
  await db.exec(
    `reset role; update site_links set url='https://web.facebook.com/shawarma.lma3louma/' where id='facebook'`,
  );
  for (const migration of [
    "20260929090000_open_links_and_social_posts.sql",
    "20260929120000_four_social_posts.sql",
  ])
    await db.exec(
      readFileSync(
        new URL(`../supabase/migrations/${migration}`, import.meta.url),
        "utf8",
      ),
    );
  await as("anon");
  assert.deepEqual(
    (
      await db.query(
        "select id, kind, platform, sort_order from site_links order by kind, sort_order",
      )
    ).rows,
    [
      { id: "glovo", kind: "order", platform: "glovo", sort_order: 0 },
      { id: "instagram", kind: "social", platform: "instagram", sort_order: 0 },
      { id: "facebook", kind: "social", platform: "facebook", sort_order: 1 },
    ],
  );
  const addLink = (values) =>
    db.query(
      `insert into site_links(id, kind, platform, label, url) values (${values}) returning id`,
    );
  const tiktok = `'tiktok','social','tiktok','','https://www.tiktok.com/@lma3loumaa'`;
  await assert.rejects(addLink(tiktok), /permission denied/);
  await as("authenticated", "00000000-0000-0000-0000-000000000002");
  await assert.rejects(addLink(tiktok), /row-level security/);
  await as("authenticated", "00000000-0000-0000-0000-000000000001");
  assert.equal((await addLink(tiktok)).rows.length, 1);
  assert.equal(
    (await addLink(`'kooul','order','other','Kooul','https://kooul.ma/x'`)).rows
      .length,
    1,
  );
  await assert.rejects(
    addLink(`'nameless','social','other','','https://example.com'`),
    /check constraint/,
  );
  await assert.rejects(
    addLink(`'script','social','x','','javascript:alert(1)'`),
    /check constraint/,
  );
  await assert.rejects(
    addLink(`'kind','shop','x','','https://x.com/a'`),
    /check constraint/,
  );
  assert.equal(
    (
      await db.query(
        `update site_links set available=false where id='tiktok' returning id`,
      )
    ).rows.length,
    1,
  );
  await assert.rejects(
    db.exec(`update site_links set available=false where id='glovo'`),
    /check constraint/,
  );
  await assert.rejects(
    db.exec(`update site_links set url='' where id='glovo'`),
    /check constraint/,
  );
  await assert.rejects(
    db.exec(`update site_links set id='renamed' where id='kooul'`),
    /permission denied/,
  );
  assert.equal(
    (await db.query(`delete from site_links where id='glovo' returning id`)).rows
      .length,
    0,
  );
  assert.equal(
    (await db.query(`delete from site_links where id='kooul' returning id`)).rows
      .length,
    1,
  );
  await as("anon");
  assert.deepEqual(
    (await db.query("select id from site_links order by id")).rows.map(
      (r) => r.id,
    ),
    ["facebook", "glovo", "instagram"],
  );
  await assert.rejects(
    db.exec(`update site_links set url='https://evil.example' where id='instagram'`),
    /permission denied/,
  );
  await as("authenticated", "00000000-0000-0000-0000-000000000002");
  assert.equal(
    (
      await db.query(
        `update site_links set url='https://evil.example' where id='instagram' returning id`,
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (await db.query(`delete from site_links where id='instagram' returning id`))
      .rows.length,
    0,
  );

  // Posts and reels: public when visible, admin-managed, at most four.
  const addPost = (id, url, video = null) =>
    db.query(
      `insert into social_posts(id, url, video) values ('${id}', '${url}', ${video ? `'${video}'` : "null"}) returning id`,
    );
  const reel = "https://www.instagram.com/reel/C1abc/";
  await as("anon");
  await assert.rejects(addPost("p0", reel), /permission denied/);
  await as("authenticated", "00000000-0000-0000-0000-000000000002");
  await assert.rejects(addPost("p0", reel), /row-level security/);
  await as("authenticated", "00000000-0000-0000-0000-000000000001");
  for (const url of [
    "https://www.youtube.com/watch?v=1",
    "https://www.instagram.com.evil.example/reel/C1abc/",
    "http://www.instagram.com/reel/C1abc/",
  ])
    await assert.rejects(addPost("bad", url), /check constraint/);
  await assert.rejects(
    addPost("bad", reel, "javascript:alert(1)"),
    /check constraint/,
  );
  for (let n = 1; n <= 4; n++)
    await addPost(`p${n}`, `https://www.tiktok.com/@lma3loumaa/video/7400000000000${n}`);
  await assert.rejects(
    addPost("p9", "https://www.facebook.com/reel/123"),
    /limited to 4/,
  );
  assert.equal(
    (
      await db.query(
        `update social_posts set available=false where id='p4' returning id`,
      )
    ).rows.length,
    1,
  );
  assert.equal(
    (await db.query(`delete from social_posts where id='p3' returning id`)).rows
      .length,
    1,
  );
  assert.equal(
    (
      await addPost(
        "p9",
        "https://web.facebook.com/reel/123",
        "https://project.supabase.co/storage/v1/object/public/social-media/posts/a.mp4",
      )
    ).rows.length,
    1,
  );
  await as("anon");
  assert.deepEqual(
    (await db.query("select id from social_posts order by id")).rows.map(
      (r) => r.id,
    ),
    ["p1", "p2", "p9"],
  );
  await assert.rejects(
    db.exec(`update social_posts set caption='x'`),
    /permission denied/,
  );
  await as("authenticated", "00000000-0000-0000-0000-000000000002");
  assert.equal(
    (await db.query(`delete from social_posts returning id`)).rows.length,
    0,
  );
  await as("authenticated", "00000000-0000-0000-0000-000000000001");
  await db.exec("reset role; delete from admin_users");
  await as("authenticated", "00000000-0000-0000-0000-000000000001");
  assert.equal(
    (await db.query(`update locations set available=false returning id`)).rows
      .length,
    0,
  );
  assert.equal(
    (
      await db.query(
        `update site_links set url='https://evil.example' where id='instagram' returning id`,
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (await db.query(`delete from social_posts returning id`)).rows.length,
    0,
  );
  console.log(
    "PASS: migration, seed, admin CRUD, anonymous/non-admin denial, no self-promotion, validation, category restrictions, publication filtering, open link list migration and permissions, 4-post limit, and immediate admin revocation.",
  );
} finally {
  await db.close();
}
