import { useEffect, useState } from "react";
import type { RefObject } from "react";
import { cancelFrame, requestFrame } from "./frame";
import { onPrerenderedPage } from "./hydration";

/** A native sticky runway consumes scroll distance without trapping wheel/touch input.
 * CSS lays the runway out (shawarmaScene.css), so it is in the first paint and the
 * page never jumps when the app starts or the reveal artwork arrives. This hook
 * turns it off without motion, measures the pin, and drives the layers once they
 * are `ready`. */
export function useShawarmaScroll(
  root: RefObject<HTMLDivElement | null>,
  runway: boolean,
  ready: boolean,
) {
  const [expanded, setExpanded] = useState(false);
  const enabled = runway && ready;

  useEffect(() => {
    const scene = root.current;
    const story = scene?.closest<HTMLElement>(".hero-story");
    const hero = story?.querySelector<HTMLElement>(".hero");
    const track = story?.querySelector<HTMLElement>(".hero-art-track");
    const art = story?.querySelector<HTMLElement>(".hero-art");
    const header = document.querySelector<HTMLElement>(".header");
    if (!scene || !story || !hero || !track || !art) return;

    let scheduled = false;
    let disposed = false;
    let mobile = false;
    let pinTop = 0;
    let travel = 0;
    let anchorTop = 0;
    let atEnd = false;
    let previous = "";
    let displayed: number | null = null;
    let lastTime = 0;
    story.dataset.scrollRunway = String(runway);
    story.dataset.scrollEnabled = String(enabled);

    function read() {
      if (disposed || !enabled || !travel) return;
      anchorTop = (mobile ? track! : story!).getBoundingClientRect().top;
    }
    function render(time: number) {
      scheduled = false;
      if (disposed) return;
      const target =
        enabled && travel
          ? Math.max(0, Math.min(1, (pinTop - anchorTop) / travel))
          : 0;
      // Smooth wheel/touch steps once for the entire scene so the model and layers
      // stay in sync. Time-based damping behaves the same at 60Hz and 120Hz.
      const elapsed = lastTime ? Math.min(time - lastTime, 64) : 1000 / 60;
      lastTime = time;
      if (displayed === null || !enabled || document.hidden) displayed = target;
      else displayed += (target - displayed) * (1 - Math.exp(-elapsed / 90));
      if (Math.abs(target - displayed) < 0.0001) displayed = target;
      else requestRender();
      if (!scheduled) lastTime = 0;
      const progress = displayed;
      const formatted = progress.toFixed(4);
      if (formatted === previous) return;
      previous = formatted;
      story!.style.setProperty("--reveal", formatted);
      scene!.dataset.progress = formatted;
      scene!.dataset.scrolling = String(progress > 0 && progress < 1);
      if (progress >= 0.98 !== atEnd) {
        atEnd = progress >= 0.98;
        setExpanded(atEnd);
      }
    }
    const task = { read, write: render };
    function requestRender() {
      scheduled = true;
      requestFrame(task);
    }
    function measure() {
      if (disposed) return;
      // Every read comes before the writes below, so they cost one layout.
      mobile = window.matchMedia("(max-width: 650px)").matches;
      const headerHeight = header?.offsetHeight ?? 80;
      const viewHeight = document.documentElement.clientHeight;
      const artHeight = art!.offsetHeight;
      const heroHeight = hero!.offsetHeight;
      pinTop = mobile
        ? Math.max(headerHeight + 12, (viewHeight - artHeight) / 2)
        : Math.min(headerHeight, viewHeight - heroHeight);
      // The scroll distance is the runway CSS laid out (0px without it).
      travel =
        parseFloat(getComputedStyle(story!).getPropertyValue("--hero-travel")) ||
        0;
      // The pin offset below moves the sticky art, not the runway it reads.
      read();
      const layout = mobile ? "mobile" : "desktop";
      if (story!.dataset.scrollLayout !== layout)
        story!.dataset.scrollLayout = layout;
      story!.style.setProperty("--story-pin-top", `${pinTop}px`);
      // Render now rather than in the next frame, whose read would force a
      // layout once anything else (hydration, content) changed the page.
      cancelFrame(task);
      render(performance.now());
    }
    setExpanded(false);
    // On the prerendered page the observer's initial callback measures
    // instead, before the next paint (hydration.ts).
    if (!onPrerenderedPage()) measure();
    const resize = new ResizeObserver(measure);
    resize.observe(hero);
    resize.observe(art);
    if (header) resize.observe(header);
    window.addEventListener("scroll", requestRender, { passive: true });
    window.addEventListener("resize", measure);
    // Font loading and language changes can alter the headline and pin offset.
    if (document.fonts.status !== "loaded")
      void document.fonts.ready.then(measure);
    return () => {
      disposed = true;
      cancelFrame(task);
      resize.disconnect();
      window.removeEventListener("scroll", requestRender);
      window.removeEventListener("resize", measure);
      story.dataset.scrollRunway = "false";
      story.dataset.scrollEnabled = "false";
    };
  }, [runway, enabled, root]);

  return expanded;
}
