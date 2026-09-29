import { readFileSync } from "node:fs";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createReviewHandler } from "./api/reviews.js";
import imageAssets from "./src/imageAssets.json" with { type: "json" };
import { heroPhoto, heroSizes } from "./src/heroPhoto.ts";

const hero = (imageAssets as Record<string, { srcSet: string }>)[heroPhoto];

export default defineConfig(({ mode }) => ({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // Keep framework dependencies together and cache them across app edits.
            {
              name: "react-vendor",
              test: /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/,
              priority: 30,
            },
            {
              name: "supabase-vendor",
              test: /node_modules[\\/]@supabase[\\/]/,
              priority: 20,
            },
            {
              name: "i18n-vendor",
              test: /node_modules[\\/](?:i18next|react-i18next)[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  plugins: [
    react(),
    {
      // The @font-face rules (under 1 KB compressed) go into the built page, so
      // the first paint no longer waits on a separate stylesheet request for
      // them. Development keeps the link to public/assets/fonts.css.
      name: "inline-font-faces",
      apply: "build",
      transformIndexHtml(html) {
        const link = '<link rel="stylesheet" href="/assets/fonts.css" />';
        if (!html.includes(link))
          throw new Error("index.html has no fonts.css link");
        const css = readFileSync("public/assets/fonts.css", "utf8");
        return html.replace(link, () => `<style>${css}</style>`);
      },
    },
    {
      // The menu, links and reviews come from Supabase once the app runs, so
      // the connection to it is set up while the app downloads. The full-menu
      // page, which shows nothing but that content, also starts reading it
      // then: the same public requests src/content.tsx makes, which it takes
      // over for its first refresh. A visitor signed in to the dashboard
      // (a stored Supabase session) reads with their own rights, so the app
      // makes those requests itself.
      name: "supabase-early-requests",
      apply: "build",
      transformIndexHtml() {
        const env = loadEnv(mode, process.cwd(), "VITE_");
        const url = env.VITE_SUPABASE_URL;
        const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!URL.canParse(url) || !key) return [];
        const tables = {
          categories: "order=sort_order.asc,id.asc",
          menu_items: "order=sort_order.asc,id.asc",
          locations: "order=sort_order.asc,id.asc",
          site_links: "",
          social_posts: "",
        };
        return [
          {
            tag: "link",
            attrs: {
              rel: "preconnect",
              href: new URL(url).origin,
              crossorigin: "",
            },
            injectTo: "head",
          },
          {
            tag: "script",
            injectTo: "head",
            children: `(() => {
  if (location.pathname !== "/menu") return;
  try {
    for (let i = 0; i < localStorage.length; i++)
      if (/^sb-.*-auth-token$/.test(localStorage.key(i))) return;
  } catch {}
  const key = ${JSON.stringify(key)};
  const read = (table, order) =>
    fetch(${JSON.stringify(new URL("/rest/v1/", url).href)} + table + "?select=*" + (order && "&" + order), {
      headers: { apikey: key, Authorization: "Bearer " + key },
    }).then(
      async (response) =>
        response.ok
          ? { data: await response.json(), error: null }
          : { data: null, error: { status: response.status } },
      (error) => ({ data: null, error }),
    );
  window.__lmaContent = Object.fromEntries(
    Object.entries(${JSON.stringify(tables)}).map(([table, order]) => [table, read(table, order)]),
  );
})();`,
          },
        ];
      },
    },
    {
      // The built index.html carries the Arabic home page, rendered at build
      // time (scripts/prerender.mjs). Other pages, a saved French or English
      // choice and reduced motion render differently, so this hides it for
      // them and src/main.tsx renders afresh. The hero photo downloads from
      // the start on the home page, even when React has to request it later.
      name: "prerendered-home",
      transformIndexHtml() {
        const preload = hero
          ? `
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.fetchPriority = "high";
    link.imageSrcset = ${JSON.stringify(hero.srcSet)};
    link.imageSizes = ${JSON.stringify(heroSizes)};
    document.head.append(link);`
          : "";
        return [
          {
            tag: "style",
            injectTo: "head",
            children: 'html[data-render="client"] #root > * { display: none; }',
          },
          {
            tag: "script",
            injectTo: "head",
            children: `(() => {
  let language = null;
  try {
    language = localStorage.getItem("lma-language");
  } catch {}
  const home = location.pathname === "/";
  if (
    !home ||
    language === "fr" ||
    language === "en" ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    document.documentElement.dataset.render = "client";
  if (home) {${preload}
  }
})();`,
          },
        ];
      },
    },
    {
      name: "local-review-api",
      configureServer(server) {
        const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
        const handler = createReviewHandler({
          env: {
            ...env,
            VERCEL: "1",
            VERCEL_ENV: "development",
            REVIEW_ALLOWED_HOSTNAMES: "localhost,127.0.0.1,[::1]",
          },
        });
        server.middlewares.use("/api/reviews", async (req, res) => {
          try {
            const chunks: Buffer[] = [];
            let size = 0;
            for await (const chunk of req) {
              size += chunk.length;
              if (size > 12000) {
                res.statusCode = 413;
                res.end();
                return;
              }
              chunks.push(chunk);
            }
            const headers = new Headers();
            for (const [name, value] of Object.entries(req.headers))
              if (value)
                headers.set(
                  name,
                  Array.isArray(value) ? value.join(",") : value,
                );
            // Local tests use the actual TCP peer, ignoring any supplied IP headers.
            headers.set(
              "x-vercel-forwarded-for",
              req.socket.remoteAddress || "127.0.0.1",
            );
            const request = new Request(
              `http://${req.headers.host}/api/reviews`,
              {
                method: req.method,
                headers,
                ...(req.method === "POST"
                  ? { body: Buffer.concat(chunks).toString() }
                  : {}),
              },
            );
            const response = await handler(request);
            res.statusCode = response.status;
            response.headers.forEach((value, name) =>
              res.setHeader(name, value),
            );
            res.end(await response.text());
          } catch {
            res.statusCode = 503;
            res.end(JSON.stringify({ error: "UNAVAILABLE" }));
          }
        });
      },
    },
  ],
}));
