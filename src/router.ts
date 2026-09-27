import { useMemo, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";

/** The public site's pages. Links between them swap the page in place, so the
 * menu already loaded from the database stays on screen instead of reloading. */
const pages = new Set(["/", "/menu", "/components"]);
const listeners = new Set<() => void>();
// Scroll offsets per history entry, restored on back and forward.
const scrollPositions = new Map<string, number>();
const entryKey = () =>
  (history.state as { key?: string } | null)?.key ?? "start";
let currentEntry = entryKey();
let currentPath = location.pathname + location.search;

function render() {
  currentEntry = entryKey();
  currentPath = location.pathname + location.search;
  flushSync(() => listeners.forEach((listener) => listener()));
}

function focusPage() {
  const heading = document.querySelector<HTMLElement>("main h1");
  if (!heading) return;
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
}

export function navigate(href: string, { replace = false } = {}) {
  const url = new URL(href, location.href);
  if (replace) {
    history.replaceState(history.state, "", url);
    render();
    return;
  }
  history.scrollRestoration = "manual";
  scrollPositions.set(currentEntry, scrollY);
  history.pushState({ key: Math.random().toString(36).slice(2) }, "", url);
  render();
  const target =
    url.hash && document.getElementById(decodeURIComponent(url.hash.slice(1)));
  if (target) target.scrollIntoView({ behavior: "instant" });
  else {
    scrollTo({ top: 0, behavior: "instant" });
    focusPage();
  }
}

function onPopState() {
  // Only the fragment changed: the browser scrolls to it on its own.
  if (location.pathname + location.search === currentPath) return;
  scrollPositions.set(currentEntry, scrollY);
  render();
  scrollTo({
    top: scrollPositions.get(currentEntry) ?? 0,
    behavior: "instant",
  });
}

function onClick(event: MouseEvent) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  const link = (event.target as Element | null)?.closest?.("a[href]");
  if (
    !(link instanceof HTMLAnchorElement) ||
    (link.target && link.target !== "_self") ||
    link.hasAttribute("download")
  )
    return;
  const url = new URL(link.href);
  if (url.origin !== location.origin || !pages.has(url.pathname)) return;
  if (url.pathname + url.search === location.pathname + location.search) return;
  event.preventDefault();
  navigate(url.href);
}

function subscribe(listener: () => void) {
  if (!listeners.size) {
    window.addEventListener("popstate", onPopState);
    document.addEventListener("click", onClick);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size) return;
    window.removeEventListener("popstate", onPopState);
    document.removeEventListener("click", onClick);
  };
}

export function useLocation() {
  const path = useSyncExternalStore(
    subscribe,
    () => location.pathname + location.search,
  );
  return useMemo(() => new URL(path, location.origin), [path]);
}
