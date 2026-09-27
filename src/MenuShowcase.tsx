import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flame,
  Heart,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Button, FoodVisual, Input, Select, Toggle } from "./components";
import { LoadingImage } from "./LoadingImage";
import type { Item, Locale, Localized } from "./data";

export type MenuShowcaseProps = {
  items: Item[];
  categories: { id: string; name: Localized; icon?: string }[];
  locale: Locale;
  category: string;
  onCategoryChange: (id: string) => void;
  query: string;
  onQueryChange: (value: string) => void;
  sort: string;
  onSortChange: (value: string) => void;
  combo: boolean;
  onComboChange: (value: boolean) => void;
  onSelect: (item: Item) => void;
};

const copy = {
  ar: {
    title: "شنو شهيتي",
    titleAccent: "اليوم؟",
    subtitle: "اختار النكهة اللي كتعجبك.",
    choose: "اختارها",
    more: "المزيد",
    previous: "النكهة السابقة",
    next: "النكهة التالية",
    flavors: "اختار النكهة",
    carousel: "استكشف النكهات",
    carouselRole: "عارض النكهات",
    mezze: "كمّلها بالمقبلات",
    mezzeDescription: "مقبلات لذيذة تكمل وجبتك.",
    closeCatalog: "رجع للنكهات",
  },
  fr: {
    title: "Une envie",
    titleAccent: "aujourd’hui ?",
    subtitle: "Trouvez la saveur qui vous ressemble.",
    choose: "Je la choisis",
    more: "Plus",
    previous: "Saveur précédente",
    next: "Saveur suivante",
    flavors: "Choisissez votre saveur",
    carousel: "Découvrez nos saveurs",
    carouselRole: "carrousel",
    mezze: "Et un petit mezzé ?",
    mezzeDescription: "La touche gourmande pour compléter votre repas.",
    closeCatalog: "Revenir aux saveurs",
  },
  en: {
    title: "What are you",
    titleAccent: "craving?",
    subtitle: "Find the flavor that’s calling your name.",
    choose: "Pick this one",
    more: "More",
    previous: "Previous flavor",
    next: "Next flavor",
    flavors: "Choose your flavor",
    carousel: "Explore our flavors",
    carouselRole: "carousel",
    mezze: "Make room for mezze",
    mezzeDescription: "A little something to complete your meal.",
    closeCatalog: "Back to the flavors",
  },
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f\u064B-\u065F]/g, "")
    .replace(/[أإآ]/g, "ا");

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

/** The restaurant's mezze shots carry a logo above the bowl and a name label
 * below it; the strip already prints the name, so frame just the bowl. */
function MezzeVisual({ item }: { item: Item }) {
  if (!item.image.startsWith("https://") && !item.image.startsWith("/assets/"))
    return (
      <FoodVisual kind={item.image} sizes="(max-width: 700px) 36vw, 210px" />
    );
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
  query,
  onQueryChange,
  sort,
  onSortChange,
  combo,
  onComboChange,
  onSelect,
}: MenuShowcaseProps) {
  const { t } = useTranslation();
  const text = copy[locale];
  const rtl = locale === "ar";
  const id = useId();
  const [activeId, setActiveId] = useState("classic");
  const [catalogOpen, setCatalogOpen] = useState(false);
  const catalogRef = useRef<HTMLDivElement>(null);
  const catalogTriggerRef = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLDetailsElement>(null);
  const selectorRef = useRef<HTMLDivElement>(null);
  const focusCatalog = useRef(false);
  const focusShowcase = useRef(false);
  const swipeStart = useRef<{ id: number; x: number; y: number } | null>(null);
  const suppressClickUntil = useRef(0);
  const showCatalog = catalogOpen || !!query || sort !== "recommended";
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
  const activeIndex = Math.max(
    0,
    stageItems.findIndex((item) => item.id === activeId),
  );
  const active = stageItems[activeIndex];
  const previous =
    stageItems[(activeIndex - 1 + stageItems.length) % stageItems.length];
  const next = stageItems[(activeIndex + 1) % stageItems.length];
  // With two dishes, previous and next are the same one: show it once.
  const showPrevious = stageItems.length > 2;
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
  const filtered = useMemo(() => {
    const search = normalize(query.trim());
    const result = items.filter(
      (item) =>
        (category === "all" || item.category === category) &&
        normalize(
          `${Object.values(item.name).join(" ")} ${Object.values(item.description).join(" ")}`,
        ).includes(search),
    );
    const itemPrice = (item: Item) =>
      combo && item.menuPrice != null ? item.menuPrice : item.price;
    if (sort === "asc") result.sort((a, b) => itemPrice(a) - itemPrice(b));
    if (sort === "desc") result.sort((a, b) => itemPrice(b) - itemPrice(a));
    return result;
  }, [items, category, query, sort, combo]);

  useEffect(() => {
    if (!showCatalog && focusShowcase.current) {
      focusShowcase.current = false;
      catalogTriggerRef.current?.scrollIntoView({
        block: "center",
        behavior: "auto",
      });
      catalogTriggerRef.current?.focus({ preventScroll: true });
    }
    if (!showCatalog || !focusCatalog.current) return;
    focusCatalog.current = false;
    catalogRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
    catalogRef.current
      ?.querySelector<HTMLInputElement>('input[type="search"]')
      ?.focus({ preventScroll: true });
  }, [showCatalog]);

  // On narrow screens the flavor row scrolls; keep the chosen one in view
  // without moving the page.
  useEffect(() => {
    const list = selectorRef.current;
    const thumb = list?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!list || !thumb || list.scrollWidth <= list.clientWidth) return;
    const listBox = list.getBoundingClientRect();
    const thumbBox = thumb.getBoundingClientRect();
    list.scrollBy({
      left:
        thumbBox.left + thumbBox.width / 2 - (listBox.left + listBox.width / 2),
      behavior:
        document.documentElement.dataset.motion === "off" ? "auto" : "smooth",
    });
  }, [active?.id]);

  const changeCategory = (categoryId: string) => {
    onCategoryChange(categoryId);
    setActiveId("classic");
    if (moreRef.current) moreRef.current.open = false;
  };
  const move = (offset: number) => {
    if (stageItems.length < 2) return;
    setActiveId(
      stageItems[(activeIndex + offset + stageItems.length) % stageItems.length]
        .id,
    );
  };
  const toggleCatalog = () => {
    if (showCatalog) {
      focusShowcase.current = true;
      setCatalogOpen(false);
      onQueryChange("");
      onSortChange("recommended");
    } else {
      focusCatalog.current = true;
      onCategoryChange("all");
      setCatalogOpen(true);
    }
  };

  return (
    <div className="menu-showcase" dir={rtl ? "rtl" : "ltr"}>
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
            <button
              type="button"
              className="menu-showcase-catalog-trigger"
              ref={catalogTriggerRef}
              aria-expanded={showCatalog}
              aria-controls={`${id}-catalog`}
              onClick={toggleCatalog}
            >
              {showCatalog ? (
                <X size={20} aria-hidden="true" />
              ) : (
                <Search size={20} aria-hidden="true" />
              )}
              <span>{showCatalog ? text.closeCatalog : t("allMenu")}</span>
            </button>
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
                    <ShowcaseVisual
                      item={previous}
                      className="flavor-neighbor-visual"
                      sizes="(max-width: 1100px) 22vw, 300px"
                    />
                    <span className="flavor-neighbor-name">
                      {previous.name[locale]}
                    </span>
                    <span className="flavor-neighbor-price">
                      {price(previous)} <small>{t("currency")}</small>
                    </span>
                  </button>
                )}
              </>
            )}
            {active ? (
              <article className="flavor-feature" key={active.id}>
                <div className="flavor-main-art">
                  <span className="flavor-backdrop" aria-hidden="true" />
                  <ShowcaseVisual
                    item={active}
                    className="flavor-main-visual"
                    sizes="(max-width: 700px) 92vw, (max-width: 1100px) 55vw, 560px"
                  />
                  <div className="flavor-price-badge">
                    {active.variants?.length ? (
                      <span>{t("from")}</span>
                    ) : (
                      <span className="sr-only">{priceLabel(active)}</span>
                    )}
                    <strong>{price(active)}</strong>
                    <small>{t("currency")}</small>
                  </div>
                </div>
                <div className="flavor-feature-copy">
                  <h3>{active.name[locale]}</h3>
                  <p>{active.description[locale]}</p>
                  <Button
                    className="flavor-choose"
                    onClick={() => onSelect(active)}
                  >
                    {text.choose}
                    <ArrowUpRight size={19} aria-hidden="true" />
                  </Button>
                </div>
              </article>
            ) : (
              <p className="flavor-empty" role="status">
                {t("noResults")}
              </p>
            )}
            {stageItems.length > 1 && (
              <>
                <button
                  type="button"
                  className="flavor-neighbor flavor-neighbor--next"
                  onClick={() => move(1)}
                  aria-label={`${text.next}: ${next.name[locale]}`}
                >
                  <ShowcaseVisual
                    item={next}
                    className="flavor-neighbor-visual"
                    sizes="(max-width: 1100px) 22vw, 300px"
                  />
                  <span className="flavor-neighbor-name">
                    {next.name[locale]}
                  </span>
                  <span className="flavor-neighbor-price">
                    {price(next)} <small>{t("currency")}</small>
                  </span>
                </button>
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

          <div
            className="flavor-selector"
            ref={selectorRef}
            role="group"
            aria-label={text.flavors}
          >
            {stageItems.map((item) => (
              <button
                type="button"
                className={`flavor-thumbnail ${item.id === active?.id ? "is-active" : ""}`}
                key={item.id}
                aria-pressed={item.id === active?.id}
                onClick={() => setActiveId(item.id)}
              >
                <span className="flavor-thumbnail-art">
                  <ShowcaseVisual item={item} sizes="90px" />
                </span>
                <span className="flavor-thumbnail-copy">
                  <span>{item.name[locale]}</span>
                  <strong>
                    {price(item)} <small>{t("currency")}</small>
                  </strong>
                </span>
              </button>
            ))}
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

      {showCatalog && (
        <div
          className="menu-catalog container"
          id={`${id}-catalog`}
          ref={catalogRef}
        >
          <div className="menu-catalog-heading">
            <h3>{t("menu")}</h3>
            <button
              type="button"
              className="text-button"
              onClick={toggleCatalog}
            >
              {text.closeCatalog}
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="menu-tools">
            <Input
              label={t("searchLabel")}
              icon={<Search size={19} />}
              type="search"
              placeholder={t("search")}
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
            <Select
              label={t("sort")}
              value={sort}
              onChange={onSortChange}
              options={[
                { value: "recommended", label: t("recommended") },
                { value: "asc", label: t("priceAsc") },
                { value: "desc", label: t("priceDesc") },
              ]}
            />
          </div>
          <div className="category-tabs" role="group" aria-label={t("menu")}>
            {categories.map((entry) => (
              <button
                type="button"
                key={entry.id}
                aria-pressed={category === entry.id}
                className={category === entry.id ? "active" : ""}
                onClick={() => changeCategory(entry.id)}
              >
                <span aria-hidden="true">{entry.icon}</span>
                {entry.name[locale]}
              </button>
            ))}
          </div>
          <div className="menu-meta">
            <p role="status">{t("results", { count: filtered.length })}</p>
            <Toggle
              label={t("combo")}
              description={t("comboHelp")}
              checked={combo}
              onChange={onComboChange}
            />
          </div>
          <div className="food-grid">
            {filtered.map((item) => (
              <article className="food-card" key={item.id}>
                <button
                  type="button"
                  className="card-visual-button"
                  onClick={() => onSelect(item)}
                  aria-label={`${t("details")} ${item.name[locale]}`}
                >
                  <div className="food-stage">
                    {item.tag && (
                      <span className={`food-tag tag-${item.tag}`}>
                        {item.tag === "spicy" ? (
                          <Flame size={12} />
                        ) : item.tag === "sharing" ? (
                          <Heart size={12} />
                        ) : (
                          <Sparkles size={12} />
                        )}{" "}
                        {t(item.tag)}
                      </span>
                    )}
                    <FoodVisual
                      kind={item.image}
                      sizes="(max-width: 650px) 50vw, 260px"
                    />
                    <span className="card-expand">
                      <Plus size={17} />
                    </span>
                  </div>
                </button>
                <div className="food-info">
                  <h3>{item.name[locale]}</h3>
                  <p>{item.description[locale]}</p>
                  <div className="food-bottom">
                    <div>
                      <span>{priceLabel(item)}</span>
                      <strong>
                        {price(item)} <small>{t("currency")}</small>
                      </strong>
                    </div>
                    <button
                      type="button"
                      className="round-button"
                      onClick={() => onSelect(item)}
                      aria-label={`${t("details")} ${item.name[locale]}`}
                    >
                      <ArrowUpRight size={19} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {!filtered.length && (
            <div className="empty-state">
              <Search size={28} />
              <h3>{t("noResults")}</h3>
              <p>{t("noResultsSub")}</p>
              <Button
                variant="secondary"
                onClick={() => {
                  onQueryChange("");
                  changeCategory("all");
                  setCatalogOpen(true);
                }}
              >
                {t("allMenu")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
