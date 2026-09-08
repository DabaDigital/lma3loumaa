import { readFileSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
const source = stripTypeScriptTypes(
  readFileSync(new URL("../src/data.ts", import.meta.url), "utf8"),
);
const { categories, items, locations } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);
const sqlValue = (value) =>
  value === undefined || value === null
    ? "null"
    : typeof value === "number"
      ? String(value)
      : `'${(typeof value === "object" ? JSON.stringify(value) : String(value)).replaceAll("'", "''")}'`;
const insert = (table, rows) =>
  rows
    .map((row, index) => {
      const data = { ...row, sort_order: index };
      return `insert into public.${table} (${Object.keys(data)
        .map((k) => `"${k}"`)
        .join(
          ", ",
        )}) values (${Object.values(data).map(sqlValue).join(", ")}) on conflict (id) do nothing;`;
    })
    .join("\n");
writeFileSync(
  new URL("../supabase/seed.sql", import.meta.url),
  "-- Initial website content. Existing records are never overwritten.\n" +
    insert(
      "categories",
      categories.filter((c) => c.id !== "all"),
    ) +
    "\n" +
    insert("menu_items", items) +
    "\n" +
    insert("locations", locations) +
    "\n",
);
console.log("Generated seed from the existing website content.");
