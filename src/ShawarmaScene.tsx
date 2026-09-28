import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { ArrowDown, Pause, Play } from "lucide-react";
import { FoodVisual } from "./components";
import type { Locale } from "./data";
import { useShawarmaScroll } from "./useShawarmaScroll";
import { RotisserieModel } from "./RotisserieModel";
import "./shawarmaScene.css";

const copy = {
  ar: {
    open: "اكتشف السرّ",
    close: "كمّل، اللذّة كتسنّاك",
    hint: "كل طبقة، حكاية",
    bread: "خبز محمّر",
    chicken: "دجاج مشوي",
    greens: "خضرة وقرمشة",
    sauce: "اللمسة الأخيرة",
    pause: "وقف حركة الطفو",
    play: "شغّل حركة الطفو",
    loading: "كنوجدو السرّ…",
  },
  fr: {
    open: "Défilez pour découvrir le secret",
    close: "Continuez, la suite vous attend",
    hint: "À chaque couche, une histoire",
    bread: "Pain doré",
    chicken: "Poulet grillé",
    greens: "La touche croquante",
    sauce: "La touche finale",
    pause: "Mettre le flottement en pause",
    play: "Animer le flottement",
    loading: "Un instant…",
  },
  en: {
    open: "Scroll slowly. Reveal the secret.",
    close: "Keep scrolling. There’s more.",
    hint: "Every layer tells a story",
    bread: "Golden pita",
    chicken: "Grilled chicken",
    greens: "A little crunch",
    sauce: "The finishing touch",
    pause: "Pause floating motion",
    play: "Play floating motion",
    loading: "One moment…",
  },
};

/** Photo layers in a CSS perspective scene with a small scroll-driven rotisserie. */
export function ShawarmaScene({
  locale,
  label,
  motion,
}: {
  locale: Locale;
  label: string;
  motion: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const depth = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const loadedLayers = useRef(new Set<number>());
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const text = copy[locale];
  const animate = motion && !paused && !reduced && visible;
  const scrollEnabled = motion && !reduced && ready && !failed;
  const expanded = useShawarmaScroll(root, scrollEnabled);

  function resetTilt() {
    cancelAnimationFrame(frame.current);
    depth.current?.style.removeProperty("--tilt-x");
    depth.current?.style.removeProperty("--tilt-y");
  }

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onPreference = () => setReduced(preference.matches);
    preference.addEventListener("change", onPreference);
    let inView = true;
    const onVisibility = () => setVisible(inView && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      onVisibility();
    });
    if (root.current) observer.observe(root.current);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      preference.removeEventListener("change", onPreference);
      document.removeEventListener("visibilitychange", onVisibility);
      observer.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, []);

  useEffect(() => {
    if (!animate) resetTilt();
  }, [animate]);

  function tilt(event: PointerEvent<HTMLDivElement>) {
    if (
      !animate ||
      event.pointerType !== "mouse" ||
      !window.matchMedia("(hover: hover) and (pointer: fine)").matches
    )
      return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(
      -1,
      Math.min(1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1),
    );
    const y = Math.max(
      -1,
      Math.min(1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1),
    );
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      depth.current?.style.setProperty("--tilt-x", `${-y * 7}deg`);
      depth.current?.style.setProperty("--tilt-y", `${x * 10}deg`);
    });
  }

  return (
    <div
      ref={root}
      className="shawarma-scene"
      data-expanded={expanded}
      data-ready={ready}
      data-still={!animate}
      onPointerMove={tilt}
      onPointerLeave={resetTilt}
    >
      <div className="shawarma-spotlight" aria-hidden="true" />
      <div className="shawarma-depth" ref={depth}>
        <div className="shawarma-halo" aria-hidden="true">
          <span />
        </div>
        <div className="shawarma-orbit shawarma-orbit--back" aria-hidden="true">
          <i />
        </div>
        <div className="shawarma-floor" aria-hidden="true" />
        <RotisserieModel motion={motion && !reduced} />
        {/* The photo and its layers float together so the hand-off never jumps. */}
        <div className="shawarma-product">
          <FoodVisual kind="classic" className="hero-food" label={label} />
          <div
            className="shawarma-layers"
            id="shawarma-layers"
            aria-hidden="true"
          >
            {["bread", "chicken", "greens", "sauce"].map((layer, index) => (
              <div
                className={`shawarma-layer shawarma-layer--${layer}`}
                key={layer}
              >
                <img
                  src="/assets/hero/shawarma-exploded-768.webp"
                  alt=""
                  width="768"
                  height="1152"
                  decoding="async"
                  loading="eager"
                  fetchPriority="low"
                  draggable={false}
                  onLoad={() => {
                    loadedLayers.current.add(index);
                    if (loadedLayers.current.size === 4) setReady(true);
                  }}
                  onError={() => setFailed(true)}
                />
              </div>
            ))}
          </div>
        </div>
        <div
          className="shawarma-orbit shawarma-orbit--front"
          aria-hidden="true"
        >
          <i />
        </div>
        <div className="shawarma-spices" aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => (
            <i key={index} />
          ))}
        </div>
      </div>
      <div
        className="shawarma-annotations"
        aria-hidden="true"
        dir={locale === "ar" ? "rtl" : "ltr"}
      >
        <span className="shawarma-annotation shawarma-annotation--bread">
          <small>01</small>
          {text.bread}
        </span>
        <span className="shawarma-annotation shawarma-annotation--chicken">
          <small>02</small>
          {text.chicken}
        </span>
        <span className="shawarma-annotation shawarma-annotation--greens">
          <small>03</small>
          {text.greens}
        </span>
        <span className="shawarma-annotation shawarma-annotation--sauce">
          <small>04</small>
          {text.sauce}
        </span>
      </div>
      <div className="shawarma-controls" dir={locale === "ar" ? "rtl" : "ltr"}>
        <span className="sr-only" role="status">
          {expanded
            ? [text.bread, text.chicken, text.greens, text.sauce].join("، ")
            : ""}
        </span>
        {scrollEnabled && (
          <div className="shawarma-scroll-cue" aria-hidden="true">
            <ArrowDown size={14} />
            <span>{expanded ? text.close : text.open}</span>
            <span className="shawarma-scroll-meter">
              <i />
            </span>
          </div>
        )}
        {motion && !reduced && (
          <button
            type="button"
            className="shawarma-motion-toggle"
            aria-pressed={paused}
            aria-label={paused ? text.play : text.pause}
            title={paused ? text.play : text.pause}
            onClick={() => setPaused((value) => !value)}
          >
            {paused ? <Play size={12} /> : <Pause size={12} />}
          </button>
        )}
        <span className="shawarma-scene-caption">
          {expanded ? text.hint : "LMA3LOUMA ORIGINAL · CASA"}
        </span>
      </div>
    </div>
  );
}
