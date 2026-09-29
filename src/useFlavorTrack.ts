import { useLayoutEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { cancelFrame, requestFrame } from "./frame";
import { onPrerenderedPage } from "./hydration";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const mod = (value: number, size: number) => ((value % size) + size) % size;
/** Signed distance around a ring of `size` dishes, in [-size / 2, size / 2). */
const around = (value: number, size: number) =>
  mod(value + size / 2, size) - size / 2;
/** Writes a custom property only when it changes: every write restyles the
 * element's whole subtree. */
function setVar(element: HTMLElement, name: string, value: string) {
  if (element.style.getPropertyValue(name) !== value)
    element.style.setProperty(name, value);
}
/** Each dish rests at the center for part of its scroll before the next one
 * slides in, so the stage reads as a sequence rather than a blur. */
function settle(position: number) {
  const step = Math.floor(position);
  const t = clamp((position - step - 0.14) / 0.72, 0, 1);
  return step + t * t * (3 - 2 * t);
}

type Options = {
  runway: RefObject<HTMLDivElement | null>;
  carousel: RefObject<HTMLDivElement | null>;
  /** Ids of the dishes on the stage, in order. */
  slides: string[];
  /** Changing it (a new category) starts again from the first dish. */
  group: string;
  /** Lets vertical scrolling slide through the dishes while the stage is pinned. */
  pin: boolean;
  animate: boolean;
  rtl: boolean;
  onActive: (index: number) => void;
};

/** Slides every dish of the stage along one horizontal track. With `pin`, a
 * native sticky runway turns vertical scroll into the track's position and
 * releases the page after the last dish; there are no wheel/touch locks, so
 * touch, keyboard scrolling and anchor links keep working. Otherwise the
 * arrows, keys and swipes ease the track from dish to dish. */
export function useFlavorTrack({
  runway,
  carousel,
  slides,
  group,
  pin,
  animate,
  rtl,
  onActive,
}: Options) {
  const target = useRef(0);
  const shownGroup = useRef(group);
  const controls = useRef({ move: (_offset: number) => {} });
  const count = slides.length;
  const key = slides.join("|");

  useLayoutEffect(() => {
    const root = runway.current;
    const track = carousel.current;
    const stage = root?.querySelector<HTMLElement>(".menu-showcase-stage");
    if (!root || !track || !stage) return;
    const header = document.querySelector<HTMLElement>(".header");
    const dock = document.querySelector<HTMLElement>(".mobile-order-bar");
    const section = root.closest<HTMLElement>("section");
    if (shownGroup.current !== group) {
      shownGroup.current = group;
      target.current = 0;
    } else target.current = count ? mod(Math.round(target.current), count) : 0;

    let pieces: HTMLElement[] = [];
    // What place() last wrote on each dish, to skip dishes that did not move.
    let written: string[] = [];
    let shift = { x: 0, y: 0, scale: 1, pager: true };
    // The runway keeps its state between runs, so a category change can hold
    // the stage in place as the runway collapses.
    let pinned = root.dataset.pinned === "true";
    let anchored = root.dataset.pinned !== undefined;
    let pinTop = 0;
    let travel = 0;
    let rootTop = 0;
    let scheduled = false;
    let lastTime = 0;
    let displayed: number | null = null;
    let placed: number | null = null;
    let active = -1;
    let disposed = false;

    function place(position: number) {
      placed = position;
      pieces.forEach((slide, index) => {
        const offset =
          count > 2 ? around(index - position, count) : index - position;
        const distance = Math.abs(offset);
        // 0 at the center, 1 in a side slot: shrinks the dish and swaps its
        // details for the side caption. Phones slide full-size dishes instead.
        const near = shift.pager ? 0 : Math.min(distance, 1);
        const opacity = clamp((1.5 - distance) * 2, 0, 1);
        const transform = `translate(${(offset * shift.x).toFixed(1)}px, ${(near * shift.y).toFixed(1)}px) scale(${(1 - near * (1 - shift.scale)).toFixed(4)})`;
        const side =
          distance < 0.5
            ? "center"
            : distance >= 1.5
              ? "away"
              : offset < 0
                ? "previous"
                : "next";
        // Dishes out of sight stay hidden and unchanged while others slide.
        const state = opacity
          ? `${transform} ${opacity.toFixed(3)} ${near.toFixed(3)} ${side}`
          : side;
        if (written[index] === state) return;
        written[index] = state;
        slide.style.transform = transform;
        slide.style.opacity = opacity.toFixed(3);
        slide.style.visibility = opacity ? "" : "hidden";
        slide.style.zIndex = distance < 0.5 ? "2" : "1";
        slide.style.setProperty("--near", near.toFixed(3));
        slide.dataset.side = side;
      });
      const index = count ? mod(Math.round(position), count) : 0;
      if (index !== active) {
        active = index;
        onActive(index);
      }
    }

    function read() {
      if (!disposed && pinned) rootTop = root!.getBoundingClientRect().top;
    }
    function paint(time: number) {
      scheduled = false;
      if (disposed) return;
      if (pinned)
        target.current = settle(
          clamp((pinTop - rootTop) / travel, 0, 1) * (count - 1),
        );
      const goal = target.current;
      // Time-based damping behaves the same at 60Hz and 120Hz.
      const elapsed = lastTime ? Math.min(time - lastTime, 64) : 1000 / 60;
      lastTime = time;
      if (displayed === null || !animate || document.hidden) displayed = goal;
      else
        displayed +=
          (goal - displayed) * (1 - Math.exp(-elapsed / (pinned ? 90 : 130)));
      if (Math.abs(goal - displayed) < 0.001) displayed = goal;
      else requestPaint();
      if (!scheduled) lastTime = 0;
      if (displayed !== placed) place(displayed);
    }
    const task = { read, write: paint };
    function requestPaint() {
      scheduled = true;
      requestFrame(task);
    }

    function measure() {
      if (disposed) return;
      pieces = [
        ...track!.querySelectorAll<HTMLElement>(":scope > .flavor-slide"),
      ];
      written = [];
      // Side dishes land on the slots the grid keeps beside the feature; the
      // other side mirrors it. Without slots (phones) the track pages instead.
      const first = pieces[0];
      const art = first?.querySelector<HTMLElement>(".flavor-main-art");
      const visual = first?.querySelector<HTMLElement>(".flavor-main-visual");
      const slot = track!.querySelector<HTMLElement>(".flavor-neighbor");
      const slotArt = slot?.querySelector<HTMLElement>(".flavor-slot-art");
      // Reads first: each write before a read would cost another layout.
      let center: number | null = null;
      if (first && art && visual) {
        center = art.offsetTop + art.offsetHeight / 2;
        shift =
          slot?.offsetParent && slotArt
            ? {
                x:
                  (slot.classList.contains("flavor-neighbor--previous")
                    ? -1
                    : 1) *
                  (slot.offsetLeft +
                    slot.offsetWidth / 2 -
                    first.offsetLeft -
                    first.offsetWidth / 2),
                y:
                  slot.offsetTop +
                  slotArt.offsetTop +
                  slotArt.offsetHeight / 2 -
                  first.offsetTop -
                  center,
                scale: slotArt.offsetHeight / visual.offsetHeight,
                pager: false,
              }
            : {
                x: (track!.offsetWidth + 24) * (rtl ? -1 : 1),
                y: 0,
                scale: 1,
                pager: true,
              };
      }

      const headerHeight = header?.offsetHeight ?? 0;
      const viewHeight = document.documentElement.clientHeight;
      // Phones keep an order bar fixed over the bottom of the screen.
      const covered =
        dock && getComputedStyle(dock).position === "fixed"
          ? dock.offsetHeight
          : 0;
      const room = viewHeight - covered - headerHeight;
      const before = stage!.getBoundingClientRect();
      // The writes below change the runway's contents, never where it starts.
      const top = root!.getBoundingClientRect().top;
      const stageHeight = stage!.offsetHeight;
      const bar = stage!.querySelector(".menu-showcase-topbar");
      const barBottom = bar
        ? bar.getBoundingClientRect().bottom - before.top
        : 0;
      const wasPinned = pinned;
      // A pinned stage is at least as tall as its room. While neither changes,
      // the stage measured above is the one that pins.
      const settled =
        wasPinned &&
        root!.style.getPropertyValue("--showcase-room") === `${room}px`;
      // Pin only when the dishes and their controls fit between the bars.
      pinned = pin && count > 1 && track!.offsetHeight + 40 <= room;
      const padding = parseFloat(
        getComputedStyle(document.documentElement).scrollPaddingTop,
      );
      if (center !== null) {
        setVar(track!, "--slide-origin", `${center}px`);
        setVar(track!, "--neighbor-scale", shift.scale.toFixed(4));
      }
      if (root!.dataset.pinned !== String(pinned))
        root!.dataset.pinned = String(pinned);
      setVar(root!, "--showcase-room", `${room}px`);
      if (pinned) {
        // A stage taller than the screen pins by its bottom, like the hero,
        // tucking the whole category bar under the header rather than
        // leaving a sliver of it showing. Pinning it or changing its room
        // resizes it: only then is it measured again, which costs a layout.
        pinTop = Math.min(
          headerHeight,
          viewHeight - covered - (settled ? stageHeight : stage!.offsetHeight),
        );
        if (bar && pinTop < headerHeight)
          pinTop = Math.min(
            pinTop,
            headerHeight -
              (settled
                ? barBottom
                : bar.getBoundingClientRect().bottom -
                  stage!.getBoundingClientRect().top),
          );
        travel = Math.round(clamp(viewHeight * 0.6, 360, 600) * (count - 1));
        setVar(root!, "--showcase-pin-top", `${pinTop}px`);
        setVar(root!, "--showcase-travel", `${travel}px`);
        // Links to #menu land on the first dish with the whole stage in view.
        if (section)
          section.style.scrollMarginTop = `${pinTop - (padding || 0)}px`;
      } else {
        travel = 0;
        root!.style.removeProperty("--showcase-pin-top");
        root!.style.removeProperty("--showcase-travel");
        if (section) section.style.scrollMarginTop = "";
      }
      let scrolled = false;
      if (wasPinned !== pinned) {
        displayed = null;
        if (!pinned && count)
          target.current = mod(Math.round(target.current), count);
        // Keep the stage where the visitor is looking; entering the runway
        // starts from its first dish.
        if (anchored && before.bottom > 0 && before.top < viewHeight) {
          const goal = pinned ? Math.max(before.top, pinTop) : before.top;
          window.scrollBy({
            top: root!.getBoundingClientRect().top - goal,
            behavior: "instant",
          });
          scrolled = true;
        }
      }
      anchored = true;
      // Place the dishes before the browser paints: no frame shows them stacked.
      placed = null;
      cancelFrame(task);
      // Unless the page just scrolled, the runway's top read before the writes
      // still holds; reading it again would force a layout.
      if (scrolled) read();
      else rootTop = top;
      paint(performance.now());
    }

    controls.current.move = (offset: number) => {
      if (count < 2) return;
      const current = Math.round(target.current);
      if (pinned) {
        // Jump the page to the dish, so the page and the track never
        // disagree, and let the track ease there. Wrapping around from one
        // end to the other slides one step, as it does off the runway.
        const index = mod(current + offset, count);
        if (displayed !== null && count > 2)
          displayed += index - (current + offset);
        window.scrollTo({
          top: Math.round(
            scrollY +
              root.getBoundingClientRect().top -
              pinTop +
              (travel * index) / (count - 1),
          ),
          behavior: "instant",
        });
        return;
      }
      // Two dishes swap places; more turn around the ring.
      target.current =
        count === 2 ? mod(current + offset, 2) : current + offset;
      requestPaint();
    };

    // Measure at once (a new category holds the stage in place with it),
    // except for the first time on the prerendered page: the observer's
    // initial callback measures then, still before the next paint
    // (hydration.ts).
    if (anchored || !onPrerenderedPage()) measure();
    const resize = new ResizeObserver(measure);
    resize.observe(stage);
    resize.observe(track);
    if (header) resize.observe(header);
    if (dock) resize.observe(dock);
    window.addEventListener("scroll", requestPaint, { passive: true });
    window.addEventListener("resize", measure);
    // Font loading and language changes move the side slots and the pin.
    if (document.fonts.status !== "loaded")
      void document.fonts.ready.then(measure);
    return () => {
      disposed = true;
      cancelFrame(task);
      resize.disconnect();
      window.removeEventListener("scroll", requestPaint);
      window.removeEventListener("resize", measure);
      controls.current.move = () => {};
      if (section) section.style.scrollMarginTop = "";
    };
  }, [runway, carousel, key, count, group, pin, animate, rtl, onActive]);

  return useMemo(
    () => ({ move: (offset: number) => controls.current.move(offset) }),
    [],
  );
}
