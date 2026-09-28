import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import { Button, FoodVisual } from "./components";
import { LoadingImage } from "./LoadingImage";
import { useFlavorTrack } from "./useFlavorTrack";
import type { Item, Locale, Localized } from "./data";

export type MenuShowcaseProps = {
  items: Item[];
  categories: { id: string; name: Localized; icon?: string }[];
  locale: Locale;
  category: string;
  onCategoryChange: (id: string) => void;
  combo: boolean;
  onComboChange: (value: boolean) => void;
  onSelect: (item: Item) => void;
  /** Scrolling slides through the shawarmas while the stage is pinned. */
  motion: boolean;
};

const copy = {
  ar: {
    title: "شنو تشهيتي",
    titleAccent: "اليوم؟",
    subtitle: "اختار الشاورما اللي كتعجبك.",
    choose: "اختارها",
    more: "المزيد",
    previous: "الشاورما السابقة",
    next: "الشاورما التالية",
    carousel: "استكشف النكهات",
    carouselRole: "عرض النكهات",
    mezze: "كمّلها بالمقبلات",
    mezzeDescription: "مقبلات لذيذة تكمل وجبتك.",
  },
  fr: {
    title: "Une envie",
    titleAccent: "aujourd’hui ?",
    subtitle: "Trouvez la saveur qui vous ressemble.",
    choose: "Je la choisis",
    more: "Plus",
    previous: "Saveur précédente",
    next: "Saveur suivante",
    carousel: "Découvrez nos saveurs",
    carouselRole: "carrousel",
    mezze: "Et un petit mezzé ?",
    mezzeDescription: "La touche gourmande pour compléter votre repas.",
  },
  en: {
    title: "What are you",
    titleAccent: "craving?",
    subtitle: "Find the flavor that’s calling your name.",
    choose: "Pick this one",
    more: "More",
    previous: "Previous flavor",
    next: "Next flavor",
    carousel: "Explore our flavors",
    carouselRole: "carousel",
    mezze: "Make room for mezze",
    mezzeDescription: "A little something to complete your meal.",
  },
};

/** Hand-drawn burst that radiates away from the heading's first word; the
 * stylesheet mirrors it for left-to-right text. */
function Rays({ className }: { className: string }) {
  return (
    <svg
      className={`showcase-rays ${className}`}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M11 27 26 21M8 22 19 10M4 20 6.5 4.5" />
    </svg>
  );
}

/** The bowls of the restaurant's mezze shots, cut out by
 * scripts/mezze-bowls.mjs: [file, width, height] by dish. */
const mezzeBowls: Record<string, [string, number, number]> = {
  houmous: ["/assets/menu/bowls/houmous-bowl.png", 982, 830],
  baba: ["/assets/menu/bowls/baba-bowl.png", 946, 768],
  moutabal: ["/assets/menu/bowls/moutabal-bowl.png", 936, 760],
  muhammara: ["/assets/menu/bowls/muhammara-bowl.png", 950, 760],
};

/** The restaurant's mezze shots carry a logo above the bowl and a name label
 * over its base; the strip already prints the name, so show just the bowl. */
function MezzeVisual({ item }: { item: Item }) {
  const bowl = mezzeBowls[item.id];
  if (bowl)
    return (
      <span className="mezze-cutout">
        <LoadingImage
          src={bowl[0]}
          alt=""
          width={bowl[1]}
          height={bowl[2]}
          sizes="(max-width: 600px) 46vw, 260px"
          loading="lazy"
          draggable={false}
        />
      </span>
    );
  if (!item.image.startsWith("https://") && !item.image.startsWith("/assets/"))
    return (
      <FoodVisual kind={item.image} sizes="(max-width: 700px) 36vw, 210px" />
    );
  // Any other shot in that layout: crop to the bowl.
  return (
    <span className="mezze-bowl">
      <LoadingImage
        src={item.image}
        alt=""
        sizes="(max-width: 700px) 45vw, 330px"
        loading="lazy"
        draggable={false}
      />
    </span>
  );
}

/** Use the clean signature photo while leaving uploaded product art untouched. */
function ShowcaseVisual({
  item,
  className = "",
  sizes,
}: {
  item: Item;
  className?: string;
  sizes: string;
}) {
  if (
    item.image === "classic" ||
    item.image === "/assets/menu/lmaaloma.png" ||
    item.image === "/assets/shawarma_normal.png"
  )
    return (
      <div className={`food-visual flavor-clean-visual ${className}`}>
        <LoadingImage
          src="/assets/shawarma_normal.png"
          alt=""
          width={1536}
          height={1024}
          sizes={sizes}
          loading="lazy"
          draggable={false}
        />
      </div>
    );
  return <FoodVisual kind={item.image} className={className} sizes={sizes} />;
}

export function MenuShowcase({
  items,
  categories,
  locale,
  category,
  onCategoryChange,
  combo,
  onComboChange,
  onSelect,
  motion,
}: MenuShowcaseProps) {
  const { t } = useTranslation();
  const text = copy[locale];
  const rtl = locale === "ar";
  const [shownIndex, setShownIndex] = useState(0);
  const runwayRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDetailsElement>(null);
  const swipeStart = useRef<{ id: number; x: number; y: number } | null>(null);
  const suppressClickUntil = useRef(0);
  const stageCategory =
    category === "all"
      ? items.some((item) => item.category === "shawarma")
        ? "shawarma"
        : (items[0]?.category ?? "shawarma")
      : category;
  const stageItems = useMemo(
    () => items.filter((item) => item.category === stageCategory),
    [items, stageCategory],
  );
  const activeIndex = Math.max(0, Math.min(shownIndex, stageItems.length - 1));
  const active = stageItems[activeIndex];
  const previous =
    stageItems[(activeIndex - 1 + stageItems.length) % stageItems.length];
  const next = stageItems[(activeIndex + 1) % stageItems.length];
  // With two dishes, previous and next are the same one: it sits on one side.
  const showPrevious =
    stageItems.length > 2 || (stageItems.length === 2 && activeIndex === 1);
  const showNext =
    stageItems.length > 2 || (stageItems.length === 2 && activeIndex === 0);
  const slideIds = useMemo(
    () => stageItems.map((item) => item.id),
    [stageItems],
  );
  const track = useFlavorTrack({
    runway: runwayRef,
    carousel: carouselRef,
    slides: slideIds,
    group: stageCategory,
    // Only the shawarmas take over the scroll; other categories stay a carousel.
    pin: motion && stageCategory === "shawarma",
    animate: motion,
    rtl,
    onActive: setShownIndex,
  });
  const price = (item: Item) =>
    combo && item.menuPrice != null ? item.menuPrice : item.price;
  const priceLabel = (item: Item) =>
    item.variants?.length
      ? t("from")
      : combo && item.menuPrice != null
        ? t("meal")
        : t("single");
  const primaryCategories = ["shawarma", "mezze", "plates", "family"]
    .map((categoryId) => categories.find((entry) => entry.id === categoryId))
    .filter((entry) => entry != null);
  const otherCategories = categories.filter(
    (entry) =>
      entry.id !== "all" &&
      !primaryCategories.some((primary) => primary.id === entry.id),
  );
  const overflowActive = otherCategories.some(
    (entry) => entry.id === stageCategory,
  );
  const mezzeItems = items
    .filter((item) => item.category === "mezze")
    .slice(0, 3);

  const changeCategory = (categoryId: string) => {
    onCategoryChange(categoryId);
    if (moreRef.current) moreRef.current.open = false;
  };
  const move = track.move;

  return (
    <div className="menu-showcase" dir={rtl ? "rtl" : "ltr"}>
      <div className="menu-showcase-runway" ref={runwayRef}>
        <div className="menu-showcase-stage">
          <div className="container menu-showcase-inner">
            <div className="menu-showcase-topbar">
              <div
                className="menu-showcase-categories"
                role="group"
                aria-label={t("menu")}
              >
                {primaryCategories.map((entry) => (
                  <button
                    type="button"
                    key={entry.id}
                    aria-pressed={stageCategory === entry.id}
                    className={stageCategory === entry.id ? "is-active" : ""}
                    onClick={() => changeCategory(entry.id)}
                  >
                    {entry.name[locale]}
                  </button>
                ))}
                {!!otherCategories.length && (
                  <details
                    className="menu-showcase-more"
                    ref={moreRef}
                    onKeyDown={(event) => {
                      if (event.key === "Escape" && moreRef.current) {
                        moreRef.current.open = false;
                        moreRef.current.querySelector("summary")?.focus();
                      }
                    }}
                  >
                    <summary className={overflowActive ? "is-active" : ""}>
                      {overflowActive
                        ? categories.find((entry) => entry.id === stageCategory)
                            ?.name[locale]
                        : text.more}
                      <ChevronDown size={16} aria-hidden="true" />
                    </summary>
                    <div className="menu-showcase-more-panel">
                      {otherCategories.map((entry) => (
                        <button
                          type="button"
                          key={entry.id}
                          aria-pressed={stageCategory === entry.id}
                          onClick={() => changeCategory(entry.id)}
                        >
                          {entry.name[locale]}
                        </button>
                      ))}
                    </div>
                  </details>
                )}
              </div>
              <a href="/menu" className="menu-showcase-catalog-trigger">
                <Search size={20} aria-hidden="true" />
                <span>{t("allMenu")}</span>
              </a>
            </div>

            <div className="menu-showcase-intro">
              <Rays className="menu-showcase-rays" />
              <h2>
                {text.title}
                <span>{text.titleAccent}</span>
              </h2>
              <p>{text.subtitle}</p>
            </div>

            <div
              ref={carouselRef}
              className="flavor-carousel"
              role="region"
              aria-roledescription={text.carouselRole}
              aria-label={text.carousel}
              tabIndex={0}
              onPointerDown={(event) => {
                suppressClickUntil.current = 0;
                if (event.pointerType === "mouse") return;
                swipeStart.current = {
                  id: event.pointerId,
                  x: event.clientX,
                  y: event.clientY,
                };
              }}
              onPointerUp={(event) => {
                const start = swipeStart.current;
                swipeStart.current = null;
                if (!start || start.id !== event.pointerId) return;
                const deltaX = event.clientX - start.x;
                const deltaY = event.clientY - start.y;
                if (
                  Math.abs(deltaX) < 45 ||
                  Math.abs(deltaX) <= Math.abs(deltaY) * 1.2
                )
                  return;
                suppressClickUntil.current = performance.now() + 400;
                move(deltaX > 0 ? (rtl ? 1 : -1) : rtl ? -1 : 1);
              }}
              onPointerCancel={() => {
                swipeStart.current = null;
              }}
              onClickCapture={(event) => {
                if (performance.now() < suppressClickUntil.current) {
                  event.preventDefault();
                  event.stopPropagation();
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  move(
                    event.key === "ArrowRight" ? (rtl ? -1 : 1) : rtl ? 1 : -1,
                  );
                }
              }}
            >
              <div
                className="flavor-meal-control"
                role="group"
                aria-label={t("combo")}
              >
                <button
                  type="button"
                  aria-pressed={!combo}
                  onClick={() => onComboChange(false)}
                >
                  {t("single")}
                </button>
                <button
                  type="button"
                  aria-pressed={combo}
                  onClick={() => onComboChange(true)}
                >
                  {t("combo")}
                </button>
              </div>
              {stageItems.length > 1 && (
                <>
                  <button
                    type="button"
                    className="flavor-arrow flavor-arrow--previous"
                    aria-label={text.previous}
                    onClick={() => move(-1)}
                  >
                    {rtl ? (
                      <ChevronRight aria-hidden="true" />
                    ) : (
                      <ChevronLeft aria-hidden="true" />
                    )}
                  </button>
                  {showPrevious && (
                    <button
                      type="button"
                      className="flavor-neighbor flavor-neighbor--previous"
                      onClick={() => move(-1)}
                      aria-label={`${text.previous}: ${previous.name[locale]}`}
                    >
                      <span className="flavor-slot-art" />
                      <span className="flavor-slot-caption" />
                    </button>
                  )}
                </>
              )}
              {active ? (
                <div className="flavor-halo" aria-hidden="true">
                  <div className="flavor-main-art">
                    <span className="flavor-backdrop" />
                  </div>
                </div>
              ) : (
                <p className="flavor-empty" role="status">
                  {t("noResults")}
                </p>
              )}
              {/* Every dish rides one track; the hook slides it into place. */}
              {stageItems.map((item, index) => {
                const shown = index === activeIndex;
                return (
                  <article
                    key={item.id}
                    className={`flavor-slide${shown ? " flavor-feature" : ""}`}
                    aria-hidden={!shown}
                    inert={!shown}
                  >
                    <div className="flavor-main-art">
                      <ShowcaseVisual
                        item={item}
                        className="flavor-main-visual"
                        sizes="(max-width: 700px) 92vw, (max-width: 1100px) 55vw, 560px"
                      />
                      <div className="flavor-price-badge">
                        {item.variants?.length ? (
                          <span>{t("from")}</span>
                        ) : (
                          <span className="sr-only">{priceLabel(item)}</span>
                        )}
                        <strong>{price(item)}</strong>
                        <small>{t("currency")}</small>
                      </div>
                    </div>
                    <div className="flavor-feature-copy">
                      <div className="flavor-slide-title">
                        <h3>{item.name[locale]}</h3>
                        <span className="flavor-slide-price">
                          {price(item)} <small>{t("currency")}</small>
                        </span>
                      </div>
                      <div className="flavor-slide-details">
                        <p>{item.description[locale]}</p>
                        <Button
                          className="flavor-choose"
                          onClick={() => onSelect(item)}
                        >
                          {text.choose}
                          <ArrowUpRight size={19} aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
              {stageItems.length > 1 && (
                <>
                  {showNext && (
                    <button
                      type="button"
                      className="flavor-neighbor flavor-neighbor--next"
                      onClick={() => move(1)}
                      aria-label={`${text.next}: ${next.name[locale]}`}
                    >
                      <span className="flavor-slot-art" />
                      <span className="flavor-slot-caption" />
                    </button>
                  )}
                  <div className="flavor-progress" aria-hidden="true">
                    {stageItems.map((item, index) => (
                      <span
                        key={item.id}
                        className={index === activeIndex ? "is-active" : ""}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="flavor-arrow flavor-arrow--next"
                    aria-label={text.next}
                    onClick={() => move(1)}
                  >
                    {rtl ? (
                      <ChevronLeft aria-hidden="true" />
                    ) : (
                      <ChevronRight aria-hidden="true" />
                    )}
                  </button>
                </>
              )}
              <p className="sr-only" aria-live="polite" aria-atomic="true">
                {active &&
                  `${active.name[locale]}, ${price(active)} ${t("currency")}, ${activeIndex + 1} / ${stageItems.length}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {!!mezzeItems.length && (
        <div className="mezze-strip">
          <div className="container mezze-strip-inner">
            <div className="mezze-strip-heading">
              <Rays className="mezze-strip-rays" />
              <h3>{text.mezze}</h3>
              <p>{text.mezzeDescription}</p>
            </div>
            {mezzeItems.map((item) => (
              <article className="mezze-strip-item" key={item.id}>
                <button
                  type="button"
                  className="mezze-strip-art"
                  onClick={() => onSelect(item)}
                  aria-label={`${t("details")} ${item.name[locale]}`}
                >
                  <MezzeVisual item={item} />
                </button>
                <div className="mezze-strip-copy">
                  <h4>{item.name[locale]}</h4>
                  <p>
                    <strong>{price(item)}</strong>{" "}
                    <small>{t("currency")}</small>
                  </p>
                  <button
                    type="button"
                    className="mezze-strip-choose"
                    onClick={() => onSelect(item)}
                    aria-label={`${text.choose}: ${item.name[locale]}`}
                  >
                    {text.choose}
                    <ArrowUpRight size={17} aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
