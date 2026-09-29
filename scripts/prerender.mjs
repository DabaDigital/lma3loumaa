// Renders the Arabic home page into dist/index.html after `vite build`, so the
// first paint arrives with the HTML instead of waiting for the app script.
// src/main.tsx hydrates it. Run by `npm run build`; it needs no browser.
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "vite";

process.env.NODE_ENV = "production";
// Just enough of a browser for the modules and the first render: a first visit
// to "/" with motion allowed. Nothing here runs effects or reads storage.
globalThis.window = globalThis;
globalThis.location = new URL("http://localhost/");
globalThis.history = { state: null };
globalThis.matchMedia = (media) => ({
  matches: false,
  media,
  addEventListener() {},
  removeEventListener() {},
});

// Optional argument: the build's outDir (default dist).
const dir = process.argv[2] || "dist";
const file = `${dir}/index.html`;
const empty = '<div id="root"></div>';
const vite = await createServer({
  mode: "production",
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true, hmr: false, ws: false },
});
try {
  const { render } = await vite.ssrLoadModule("/src/entry-server.tsx");
  // React adds preload hints for eager images. Those images sit at the top of
  // the markup, and index.html preloads the hero on the home page only, so the
  // hints would just send /menu and /admin (same index.html) after them.
  const body = render().replace(/^(?:<link rel="preload" as="image"[^>]*>)+/, "");
  let page = await readFile(file, "utf8");
  if (!page.includes(empty)) throw new Error(`${file} has no empty #root`);
  // The other pages (the full menu, the dashboard) render in the browser.
  // vercel.json serves them the built page as it was, so they neither download
  // the hidden home page's photos nor wait behind it for the app.
  await writeFile(`${dir}/app.html`, page);
  page = page.replace(empty, `<div id="root">${body}</div>`);
  // The page is already in the HTML, so the app need not compete with it: its
  // files start downloading once the page has loaded and the hero photo is on
  // screen (3s at most). It starts at once when index.html hid the
  // prerendered page (data-render), or in a background tab.
  const entry = page.match(
    /<script type="module" crossorigin src="([^"]+)"><\/script>\s*/,
  );
  if (!entry) throw new Error(`${file} has no module entry script`);
  const chunks = [];
  page = page
    .replace(entry[0], "")
    .replace(
      /<link rel="modulepreload" crossorigin href="([^"]+)">\s*/g,
      (_, href) => (chunks.push(href), ""),
    )
    .replace(
      "</body>",
      `  <script>
      (() => {
        let started = false;
        const start = () => {
          if (started) return;
          started = true;
          for (const href of ${JSON.stringify(chunks)}) {
            const link = document.createElement("link");
            link.rel = "modulepreload";
            link.crossOrigin = "";
            link.href = href;
            document.head.append(link);
          }
          import(${JSON.stringify(entry[1])});
        };
        const painted = () => {
          const hero = document.querySelector(".hero-food img");
          Promise.resolve(hero?.decode())
            .catch(() => {})
            .then(() =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => setTimeout(start)),
              ),
            );
        };
        if (document.hidden || document.documentElement.dataset.render) start();
        else if (document.readyState === "complete") painted();
        else addEventListener("load", painted, { once: true });
        setTimeout(start, 3000);
      })();
    </script>
  </body>`,
    );
  await writeFile(file, page);
  console.log(`Prerendered / into ${file} (${(body.length / 1024).toFixed(1)} KB)`);
} finally {
  await vite.close();
}
// The Supabase client can keep timers alive; the page is written.
process.exit(0);
