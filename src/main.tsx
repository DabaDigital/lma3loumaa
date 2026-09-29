import { startTransition } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
// Root (i18n, then App and its stylesheets) comes first to keep the cascade.
import { Root } from "./Root";
import { setPrerenderedPage } from "./hydration";
import "./styles.css";
import "./reviews.css";
import "./skeleton.css";

const container = document.getElementById("root")!;
const tree = <Root admin={/^\/admin(?:\/|$)/.test(window.location.pathname)} />;
// index.html carries the Arabic home page, rendered at build time by
// scripts/prerender.mjs. Hydrating it keeps the first paint that arrived with
// the HTML. Another page, language or reduced motion renders differently, so
// index.html hides the prerendered page for those visitors (data-render) and
// the app renders afresh. Both run as a transition, which React splits into
// short tasks instead of one long one.
startTransition(() => {
  const html = document.documentElement;
  if (container.firstElementChild && html.dataset.render !== "client") {
    // Until the first client-side navigation (hydration.ts).
    setPrerenderedPage(true);
    hydrateRoot(container, tree);
    return;
  }
  container.replaceChildren();
  delete html.dataset.render;
  createRoot(container).render(tree);
});
