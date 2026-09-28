import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { ArrowUpRight, Layers3, Pause, Play, X } from "lucide-react";
import { FoodVisual } from "./components";
import type { Locale } from "./data";
import "./shawarmaScene.css";

const copy = {
  ar: {
    open: "اكتشف السرّ",
    close: "جمع اللذّة",
    hint: "كل طبقة، حكاية",
    bread: "خبز محمّر",
    chicken: "دجاج مشوي",
    greens: "خضرة وقرمشة",
    sauce: "اللمسة الأخيرة",
    pause: "وقف الحركة",
    play: "شغّل الحركة",
    loading: "كنوجدو السرّ…",
  },
  fr: {
    open: "Découvrez le secret",
    close: "Tout réunir",
    hint: "À chaque couche, une histoire",
    bread: "Pain doré",
    chicken: "Poulet grillé",
    greens: "La touche croquante",
    sauce: "La touche finale",
    pause: "Mettre en pause",
    play: "Animer",
    loading: "Un instant…",
  },
  en: {
    open: "Reveal the secret",
    close: "Bring it together",
    hint: "Every layer tells a story",
    bread: "Golden pita",
    chicken: "Grilled chicken",
    greens: "A little crunch",
    sauce: "The finishing touch",
    pause: "Pause animation",
    play: "Play animation",
    loading: "One moment…",
  },
};

/** Photo layers in a CSS perspective scene: no WebGL, video or scroll capture. */
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
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const text = copy[locale];
  const animate = motion && !paused && !reduced && visible;

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
                loading="lazy"
                draggable={false}
                onLoad={index === 0 ? () => setReady(true) : undefined}
                onError={
                  index === 0
                    ? () => {
                        setFailed(true);
                        setExpanded(false);
                      }
                    : undefined
                }
              />
            </div>
          ))}
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
        {!failed && (
          <button
            type="button"
            className="shawarma-reveal-toggle"
            aria-expanded={expanded}
            aria-controls="shawarma-layers"
            disabled={!ready}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? <X size={15} /> : <Layers3 size={15} />}
            <span>
              {!ready ? text.loading : expanded ? text.close : text.open}
            </span>
            {!expanded && <ArrowUpRight size={15} />}
          </button>
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
