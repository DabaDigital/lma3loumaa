import { useEffect, useState } from "react";
import type { RefObject } from "react";

/** A native sticky runway consumes scroll distance without trapping wheel/touch input. */
export function useShawarmaScroll(
  root: RefObject<HTMLDivElement | null>,
  enabled: boolean,
) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const scene = root.current;
    const story = scene?.closest<HTMLElement>(".hero-story");
    const hero = story?.querySelector<HTMLElement>(".hero");
    const track = story?.querySelector<HTMLElement>(".hero-art-track");
    const art = story?.querySelector<HTMLElement>(".hero-art");
    const header = document.querySelector<HTMLElement>(".header");
    if (!scene || !story || !hero || !track || !art) return;

    let frame = 0;
    let disposed = false;
    let mobile = false;
    let pinTop = 0;
    let travel = 0;
    let atEnd = false;
    let previous = "";
    let displayed: number | null = null;
    let lastTime = 0;
    story.dataset.scrollEnabled = String(enabled);

    function render(time: number) {
      frame = 0;
      if (disposed) return;
      const anchor = mobile ? track! : story!;
      const target = enabled
        ? Math.max(
            0,
            Math.min(1, (pinTop - anchor.getBoundingClientRect().top) / travel),
          )
        : 0;
      // Smooth wheel/touch steps once for the entire scene so the model and layers
      // stay in sync. Time-based damping behaves the same at 60Hz and 120Hz.
      const elapsed = lastTime ? Math.min(time - lastTime, 64) : 1000 / 60;
      lastTime = time;
      if (displayed === null || !enabled || document.hidden) displayed = target;
      else displayed += (target - displayed) * (1 - Math.exp(-elapsed / 90));
      if (Math.abs(target - displayed) < 0.0001) displayed = target;
      else frame = requestAnimationFrame(render);
      if (!frame) lastTime = 0;
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
    function requestRender() {
      if (!frame) frame = requestAnimationFrame(render);
    }
    function measure() {
      if (disposed) return;
      mobile = window.matchMedia("(max-width: 650px)").matches;
      story!.dataset.scrollLayout = mobile ? "mobile" : "desktop";
      const headerHeight = header?.offsetHeight ?? 80;
      const viewHeight = document.documentElement.clientHeight;
      story!.style.setProperty(
        "--hero-viewport-height",
        `${viewHeight - headerHeight}px`,
      );
      const artHeight = art!.offsetHeight;
      const heroHeight = hero!.offsetHeight;
      pinTop = mobile
        ? Math.max(headerHeight + 12, (viewHeight - artHeight) / 2)
        : Math.min(headerHeight, viewHeight - heroHeight);
      travel = Math.round(Math.max(550, Math.min(1000, viewHeight * 0.9)));
      story!.style.setProperty(
        "--hero-travel",
        enabled ? `${travel}px` : "0px",
      );
      story!.style.setProperty("--hero-height", `${heroHeight}px`);
      story!.style.setProperty("--art-height", `${artHeight}px`);
      story!.style.setProperty("--story-pin-top", `${pinTop}px`);
      requestRender();
    }
    setExpanded(false);
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(hero);
    resize.observe(art);
    if (header) resize.observe(header);
    window.addEventListener("scroll", requestRender, { passive: true });
    window.addEventListener("resize", measure);
    // Font loading and language changes can alter the headline and pin offset.
    void document.fonts.ready.then(measure);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener("scroll", requestRender);
      window.removeEventListener("resize", measure);
      story.dataset.scrollEnabled = "false";
    };
  }, [enabled, root]);

  return expanded;
}
