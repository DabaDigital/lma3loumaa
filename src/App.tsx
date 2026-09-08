import { LoadingImage } from "./LoadingImage";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  ArrowUp,
  Search,
  MapPin,
  ShoppingBag,
  Menu,
  Flame,
  Heart,
  Utensils,
  CalendarDays,
  Check,
  Plus,
  Sparkles,
  Navigation,
  RefreshCw,
} from "lucide-react";
import {
  Button,
  Input,
  Select,
  Toggle,
  Dropdown,
  DatePicker,
  TimePicker,
  Modal,
  FoodVisual,
  ExternalLink,
} from "./components";
import { categories as initialCategories, glovoUrl } from "./data";
import { usePublicContent } from "./content";
import type { Item, Locale } from "./data";
import { makeVisitCalendar } from "./calendar";
import { Reviews } from "./ReviewSection";
import { ContentSkeleton, Skeleton } from "./Skeleton";

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f\u064B-\u065F]/g, "")
    .replace(/[أإآ]/g, "ا");
function Brand({ footer = false }: { footer?: boolean }) {
  return (
    <a
      href="/#top"
      className={`brand ${footer ? "brand-footer" : ""}`}
      aria-label="Shawarma Lma3louma"
    >
      <span className="brand-mark">
        <LoadingImage src="/assets/lma3louma-logo.png" alt="" />
      </span>
    </a>
  );
}

export default function App() {
  const content = usePublicContent();
  const { items, locations } = content;
  const categories = [initialCategories[0], ...content.categories];
  const familyItem = items.find((i) => i.id === "family");
  const { t, i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage || "fr") as Locale;
  const [mobileNav, setMobileNav] = useState(false),
    [category, setCategory] = useState("all"),
    [query, setQuery] = useState(""),
    [sort, setSort] = useState("recommended"),
    [combo, setCombo] = useState(false),
    [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<Item | null>(null),
    [orderOpen, setOrderOpen] = useState(false),
    [visit, setVisit] = useState<string | null>(null);
  const [motion, setMotion] = useState(
    () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    try {
      localStorage.setItem("lma-language", locale);
    } catch {
      /* Optional storage. */
    }
    document.title =
      locale === "ar"
        ? "شاورما المعلومة — اللذة لي كتجمعنا"
        : locale === "en"
          ? "Shawarma Lma3louma — A taste of Casa"
          : "Shawarma Lma3louma — Le goût de Casa";
  }, [locale]);
  useEffect(() => {
    document.documentElement.dataset.motion = motion ? "on" : "off";
  }, [motion]);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            observer.unobserve(e.target);
          }
        }),
      { threshold: 0.08 },
    );
    document.querySelectorAll(".reveal").forEach((e) => observer.observe(e));
    return () => observer.disconnect();
  }, [content.loading, items.length, locations.length]);
  const filtered = useMemo(() => {
    const result = items.filter(
      (i) =>
        (category === "all" || i.category === category) &&
        normalize(
          `${Object.values(i.name).join(" ")} ${Object.values(i.description).join(" ")}`,
        ).includes(normalize(query)),
    );
    const price = (i: Item) =>
      combo && i.menuPrice != null ? i.menuPrice : i.price;
    if (sort === "asc") result.sort((a, b) => price(a) - price(b));
    if (sort === "desc") result.sort((a, b) => price(b) - price(a));
    return result;
  }, [category, query, sort, combo, items]);
  useEffect(() => {
    if (
      category !== "all" &&
      !content.categories.some((c) => c.id === category)
    )
      setCategory("all");
    if (selected) setSelected(items.find((i) => i.id === selected.id) ?? null);
    if (visit && !locations.some((l) => l.id === visit)) setVisit(null);
  }, [content.categories, items, locations]);
  const visible =
    category === "all" && !query && !expanded ? filtered.slice(0, 8) : filtered;
  const setLang = (lng: Locale) => {
    void i18n.changeLanguage(lng);
    setMobileNav(false);
  };
  const navLinks = (
    <>
      <a href="/#menu" onClick={() => setMobileNav(false)}>
        {t("menu")}
      </a>
      <a href="/#story" onClick={() => setMobileNav(false)}>
        {t("story")}
      </a>
      <a href="/#locations" onClick={() => setMobileNav(false)}>
        {t("locations")}
      </a>
    </>
  );
  const showComponents = window.location.pathname === "/components";
  return (
    <>
      <a className="skip-link" href="#main">
        {t("skip")}
      </a>
      <header className="header" id="top">
        <div className="header-inner">
          <Brand />
          <nav className="desktop-nav" aria-label={t("nav")}>
            {navLinks}
          </nav>
          <div className="header-actions">
            <Dropdown value={locale} onChange={setLang} />
            <Button className="header-order" onClick={() => setOrderOpen(true)}>
              {t("order")}
              <ArrowUpRight size={17} />
            </Button>
            <button
              className="mobile-menu"
              aria-label={t("nav")}
              aria-expanded={mobileNav}
              aria-controls="mobile-nav"
              onClick={() => setMobileNav(!mobileNav)}
            >
              <Menu />
            </button>
          </div>
        </div>
        {mobileNav && (
          <nav className="mobile-nav" id="mobile-nav" aria-label={t("nav")}>
            {navLinks}
            <button
              onClick={() => {
                setMobileNav(false);
                setOrderOpen(true);
              }}
            >
              {t("orderGlovo")}
              <ArrowUpRight size={18} />
            </button>
          </nav>
        )}
      </header>
      <main id="main">
        {content.error && (
          <div
            className="container content-status"
            role={content.error ? "alert" : "status"}
          >
            {locale === "ar"
              ? content.error
                ? "تعذّر تحميل القائمة. حاول مجدداً."
                : "جارٍ تحميل القائمة…"
              : locale === "en"
                ? content.error
                  ? "Unable to load the menu. Please retry."
                  : "Loading menu…"
                : content.error
                  ? "Impossible de charger la carte. Réessayez."
                  : "Chargement de la carte…"}
            {content.error && (
              <Button
                variant="secondary"
                onClick={() => void content.refresh()}
              >
                <RefreshCw size={16} />
              </Button>
            )}
          </div>
        )}
        {showComponents ? (
          <ComponentGallery
            motion={motion}
            setMotion={setMotion}
            locale={locale}
            setLang={setLang}
          />
        ) : (
          <>
            <section className="hero">
              <div className="hero-grain" />
              <div className="container hero-grid">
                <div className="hero-copy">
                  <p className="eyebrow">
                    <span className="little-star">✦</span>
                    <span lang={locale === "en" ? "en" : "ar"} dir="auto">
                      {t("eyebrow")}
                    </span>
                  </p>
                  <h1>
                    {t("hero1")}
                    <br />
                    {t("hero2")}
                    <br />
                    <span>{t("hero3")}</span>
                  </h1>
                  <p className="hero-subtitle">{t("heroSub")}</p>
                  <p className="hero-description">{t("heroDesc")}</p>
                  <div className="hero-buttons">
                    <a href="/#menu" className="button button--primary">
                      {t("discover")}
                      <ArrowDown size={18} />
                    </a>
                    <a href="/#locations" className="hero-location">
                      <MapPin size={18} />
                      {t("findUs")}
                    </a>
                  </div>
                  <p className="hero-note">
                    <ShoppingBag size={14} />
                    {t("heroNote")}
                  </p>
                </div>
                <div className="hero-art">
                  <span className="hero-ring ring-one" />
                  <span className="hero-ring ring-two" />
                  <span className="hero-orbit">✳</span>
                  <span className="hero-arabic" lang="ar" dir="rtl">
                    مكتنساااش
                  </span>
                  <div className="hero-disc" />
                  <FoodVisual
                    kind="classic"
                    className="hero-food"
                    label={items[0]?.name[locale] || "Shawarma"}
                  />
                  <div className="hero-sticker">
                    <span>{t("heroSticker")}</span>
                    <Heart size={24} />
                    <span>{t("heroSticker2")}</span>
                  </div>
                  <div className="price-note">
                    <span>{t("from")}</span>
                    <strong>
                      {content.loading ? (
                        <Skeleton className="skeleton-number" />
                      ) : (
                        (items.find((i) => i.id === "classic")?.price ??
                        items[0]?.price ??
                        "—")
                      )}
                      <small>{t("currency")}</small>
                    </strong>
                    <svg viewBox="0 0 70 35" aria-hidden="true">
                      <path d="M4 4C22 34 40 27 64 9m-17 0 17 0-3 17" />
                    </svg>
                  </div>
                  <span className="art-caption">LMA3LOUMA ORIGINAL · CASA</span>
                </div>
              </div>
              <div className="hero-bottom container">
                <span>01 / 04</span>
                <a href="/#menu">
                  {t("scroll")}
                  <ArrowDown size={14} />
                </a>
                <span lang="ar" dir="rtl">شاورما هي لمعلومة</span>
              </div>
            </section>
            <div className="ticker" aria-hidden="true">
              <div>
                {[0, 1, 2, 3].map((n) => (
                  <span key={n}>
                    {t("ticker1")}
                    <b>✦</b>
                    {t("ticker2")}
                    <b>✦</b>
                    {t("ticker3")}
                    <b>✦</b>
                  </span>
                ))}
              </div>
            </div>
            <section id="menu" className="menu-section section container">
              <div className="section-heading reveal">
                <div>
                  <p className="eyebrow">{t("menuEyebrow")}</p>
                  <h2>{t("menuTitle")}</h2>
                  <p>{t("menuDesc")}</p>
                </div>
                <span className="handwritten" lang="ar">
                  حس بالفرق <span>↙</span>
                </span>
              </div>
              {content.loading ? (
                <ContentSkeleton kind="menu" />
              ) : (
                <>
                  <div className="menu-tools">
                    <Input
                      label={t("searchLabel")}
                      icon={<Search size={19} />}
                      type="search"
                      placeholder={t("search")}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <Select
                      label={t("sort")}
                      value={sort}
                      onChange={setSort}
                      options={[
                        { value: "recommended", label: t("recommended") },
                        { value: "asc", label: t("priceAsc") },
                        { value: "desc", label: t("priceDesc") },
                      ]}
                    />
                  </div>
                  <div
                    className="category-tabs"
                    role="group"
                    aria-label={t("menu")}
                  >
                    {categories.map((c) => (
                      <button
                        key={c.id}
                        aria-pressed={c.id === category}
                        className={category === c.id ? "active" : ""}
                        onClick={() => {
                          setCategory(c.id);
                          setExpanded(false);
                        }}
                      >
                        <span aria-hidden="true">{c.icon}</span>
                        {c.name[locale]}
                      </button>
                    ))}
                  </div>
                  <div className="menu-meta">
                    <p role="status">
                      {t("results", { count: filtered.length })}
                    </p>
                    <Toggle
                      label={t("combo")}
                      description={t("comboHelp")}
                      checked={combo}
                      onChange={setCombo}
                    />
                  </div>
                  <div className="food-grid">
                    {visible.map((item, index) => (
                      <article
                        className="food-card"
                        key={item.id}
                        style={{
                          animationDelay: `${Math.min(index, 7) * 35}ms`,
                        }}
                      >
                        <button
                          className="card-visual-button"
                          onClick={() => setSelected(item)}
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
                            <span
                              className="food-stage-word"
                              aria-hidden="true"
                            >
                              {item.category === "mezze"
                                ? "MEZZÉ"
                                : item.category === "family"
                                  ? "PARTAGE"
                                  : "LMA3LOUMA"}
                            </span>
                            <FoodVisual kind={item.image} />
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
                              <span>
                                {item.variants
                                  ? t("from")
                                  : combo && item.menuPrice != null
                                    ? t("meal")
                                    : t("single")}
                              </span>
                              <strong>
                                {combo && item.menuPrice != null
                                  ? item.menuPrice
                                  : item.price}{" "}
                                <small>{t("currency")}</small>
                              </strong>
                            </div>
                            <button
                              className="round-button"
                              onClick={() => setSelected(item)}
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
                      <Search size={36} />
                      <h3>{t("noResults")}</h3>
                      <p>{t("noResultsSub")}</p>
                      <Button
                        onClick={() => {
                          setQuery("");
                          setCategory("all");
                        }}
                      >
                        {t("reset")}
                      </Button>
                    </div>
                  )}
                  {category === "all" && !query && filtered.length > 8 && (
                    <div className="menu-more">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setExpanded(!expanded);
                          if (expanded)
                            document.getElementById("menu")?.scrollIntoView({
                              behavior: motion ? "smooth" : "instant",
                            });
                        }}
                      >
                        {t(expanded ? "lessMenu" : "allMenu")}
                        {expanded ? (
                          <ArrowUp size={17} />
                        ) : (
                          <ArrowDown size={17} />
                        )}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </section>
            {content.loading && (
              <div className="container">
                <ContentSkeleton kind="banner" />
              </div>
            )}
            {familyItem && (
              <section className="family-section container reveal">
                <div className="family-art">
                  <span className="family-art-word" aria-hidden="true">
                    TOGETHER
                  </span>
                  <FoodVisual
                    kind={familyItem.image}
                    label={familyItem.name[locale]}
                  />
                  <div className="family-price">
                    <small>{t("from")}</small>
                    <strong>
                      {familyItem.price} <span>{t("currency")}</span>
                    </strong>
                  </div>
                  <span className="family-spark">✦</span>
                </div>
                <div className="family-copy">
                  <p className="eyebrow">{t("familyEyebrow")}</p>
                  <h2>
                    {t("familyTitle")}
                    <br />
                    <span>{t("familyTitle2")}</span>
                  </h2>
                  <p>{t("familyDesc")}</p>
                  <Button onClick={() => setSelected(familyItem)}>
                    {t("familyCta")}
                    <ArrowUpRight size={18} />
                  </Button>
                </div>
              </section>
            )}
            <section className="story-section section container" id="story">
              <div className="story-art reveal">
                <div className="story-topline">
                  <span>CASABLANCA</span>
                  <span>✳</span>
                  <span>LMA3LOUMA</span>
                </div>
                <span className="story-arabic" dir="rtl" lang="ar">
                  {t("storyArabic")}
                </span>
                <div className="story-visuals">
                  <FoodVisual kind="rolls" />
                </div>
                <p lang="ar" dir="rtl">{t("storyCaption")}</p>
                <div className="story-bottomline">
                  ✦ &nbsp; LMA3LOUMA &nbsp; ✦
                </div>
              </div>
              <div className="story-copy reveal">
                <p className="eyebrow">{t("storyEyebrow")}</p>
                <h2>
                  {t("storyTitle")}
                  <br />
                  <span>{t("storyTitle2")}</span>
                </h2>
                <p>{t("storyDesc")}</p>
                <div className="story-feature">
                  <span>
                    <Utensils size={22} />
                  </span>
                  <div>
                    <h3>{t("storyOne")}</h3>
                    <p>{t("storyOneDesc")}</p>
                  </div>
                </div>
                <div className="story-feature">
                  <span>
                    <Heart size={22} />
                  </span>
                  <div>
                    <h3>{t("storyTwo")}</h3>
                    <p>{t("storyTwoDesc")}</p>
                  </div>
                </div>
              </div>
            </section>
            <Reviews />
            <section className="locations-section" id="locations">
              <div className="container section">
                <div className="section-heading reveal">
                  <div>
                    <p className="eyebrow">{t("locationEyebrow")}</p>
                    <h2>{t("locationTitle")}</h2>
                    <p>{t("locationDesc")}</p>
                  </div>
                  <div className="location-doodle">
                    <MapPin size={48} strokeWidth={1.2} />
                    <span>Casa ♡</span>
                  </div>
                </div>
                {content.loading ? (
                  <ContentSkeleton kind="locations" />
                ) : (
                  <div className="locations-grid">
                    {locations.map((loc, index) => (
                      <article className="location-card reveal" key={loc.id}>
                        <div className="location-photo">
                          <LoadingImage
                            src={loc.image}
                            alt={`Shawarma Lma3louma — ${loc.name[locale]}`}
                            loading="lazy"
                          />
                          <span className="location-number">0{index + 1}</span>
                          <span className="location-photo-label">
                            <MapPin size={14} />
                            {loc.name[locale]}
                          </span>
                        </div>
                        <div className="location-info">
                          <p className="eyebrow">{loc.area[locale]}</p>
                          <h3>{loc.name[locale]}</h3>
                          <p className="location-address">
                            <MapPin size={17} />
                            {loc.address[locale]}
                          </p>
                          <div className="location-buttons">
                            <ExternalLink
                              href={loc.map}
                              className="button--secondary"
                            >
                              {t("directions")}
                            </ExternalLink>
                            <button
                              className="text-button"
                              onClick={() => setVisit(loc.id)}
                            >
                              <CalendarDays size={16} />
                              {t("planVisit")}
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
            <section className="delivery-section container reveal">
              <div className="delivery-icon">
                <ShoppingBag size={62} strokeWidth={1.2} />
                <span>✦</span>
              </div>
              <div>
                <p className="eyebrow">{t("deliveryEyebrow")}</p>
                <h2>{t("deliveryTitle")}</h2>
                <p>{t("deliveryDesc")}</p>
              </div>
              <div className="delivery-action">
                <Button onClick={() => setOrderOpen(true)}>
                  {t("orderGlovo")}
                  <ArrowUpRight size={18} />
                </Button>
                <p>{t("deliveryNote")}</p>
              </div>
            </section>
          </>
        )}
      </main>
      <footer>
        <div className="container footer-top">
          <div>
            <Brand footer />
            <p>{t("footerText")}</p>
          </div>
          <div className="footer-links">
            <strong>{t("menu")}</strong>
            {content.categories.slice(0, 3).map((c) => (
              <a key={c.id} href="/#menu" onClick={() => setCategory(c.id)}>
                {c.name[locale]}
              </a>
            ))}
          </div>
          <div className="footer-links">
            <strong>{t("locations")}</strong>
            {locations.map((loc) => (
              <a
                key={loc.id}
                href={loc.map}
                target="_blank"
                rel="noopener noreferrer"
              >
                {loc.name[locale]}
                <ArrowUpRight size={12} />
              </a>
            ))}
            <button onClick={() => setOrderOpen(true)}>
              {t("orderGlovo")}
              <ArrowUpRight size={12} />
            </button>
          </div>
          <div className="footer-tagline">
            <span lang="ar" dir="rtl">
              لمعلومة مكتنساااش
            </span>
            <p>{t("footerTag")}</p>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>
            © {new Date().getFullYear()} {t("footerRights")}
          </span>
          <Toggle label={t("motion")} checked={motion} onChange={setMotion} />
          <a href="/admin">Administration</a>
          <a href="/#top">
            {t("backTop")}
            <ArrowUp size={14} />
          </a>
        </div>
      </footer>
      {!showComponents && (
        <div className="mobile-order-bar">
          <a href="/#menu">
            <Utensils size={18} />
            {t("menu")}
          </a>
          <Button onClick={() => setOrderOpen(true)}>
            <ShoppingBag size={17} />
            {t("orderGlovo")}
            <ArrowUpRight size={16} />
          </Button>
        </div>
      )}
      {selected && (
        <ItemModal
          item={selected}
          comboDefault={combo}
          locale={locale}
          onClose={() => setSelected(null)}
        />
      )}
      {orderOpen && (
        <Modal title={t("deliveryModal")} onClose={() => setOrderOpen(false)}>
          <div className="order-modal">
            <span className="modal-icon">
              <ShoppingBag size={32} />
            </span>
            <p className="eyebrow">{t("delivery")}</p>
            <h2>{t("deliveryModal")}</h2>
            <p>{t("deliveryModalDesc")}</p>
            <ol className="order-steps">
              {[1, 2, 3].map((n) => (
                <li key={n}>
                  <span>0{n}</span>
                  {t(`step${n}`)}
                </li>
              ))}
            </ol>
            <ExternalLink
              href={glovoUrl(locale)}
              className="button--primary full-width"
            >
              {t("glovoOpen")}
            </ExternalLink>
            <p className="small-note">{t("deliveryNote")}</p>
          </div>
        </Modal>
      )}
      {visit && (
        <VisitModal
          locationId={visit}
          locale={locale}
          onClose={() => setVisit(null)}
        />
      )}
    </>
  );
}

function ItemModal({
  item,
  comboDefault,
  locale,
  onClose,
}: {
  item: Item;
  comboDefault: boolean;
  locale: Locale;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [variant, setVariant] = useState("0"),
    [meal, setMeal] = useState(comboDefault);
  const chosenVariant = item.variants?.[Number(variant)] ?? item.variants?.[0];
  const price = chosenVariant
    ? chosenVariant.price
    : meal && item.menuPrice != null
      ? item.menuPrice
      : item.price;
  return (
    <Modal
      title={item.name[locale]}
      onClose={onClose}
      className="product-modal"
    >
      <div className="product-modal-art">
        <FoodVisual kind={item.image} label={item.name[locale]} />
      </div>
      <div className="product-modal-copy">
        <p className="eyebrow">{t("chooseItem")}</p>
        <h2>{item.name[locale]}</h2>
        <p>{item.description[locale]}</p>
        {!!item.variants?.length && (
          <div className="field">
            <span>{t("variant")}</span>
            <Select
              label={t("variant")}
              value={item.variants?.[Number(variant)] ? variant : "0"}
              onChange={setVariant}
              options={
                item.variants?.map((v, i) => ({
                  value: String(i),
                  label: `${v.name[locale]} — ${v.price} ${t("currency")}`,
                })) ?? []
              }
            />
          </div>
        )}
        {item.menuPrice != null && (
          <Toggle
            label={t("combo")}
            description={t("comboHelp")}
            checked={meal}
            onChange={setMeal}
          />
        )}
        <div className="product-price">
          <span>
            {item.menuPrice != null && meal
              ? t("meal")
              : chosenVariant
                ? chosenVariant.name[locale]
                : t("single")}
          </span>
          <strong>
            {price} <small>{t("currency")}</small>
          </strong>
        </div>
        <ExternalLink
          href={glovoUrl(locale)}
          className="button--primary full-width"
        >
          {t("orderGlovo")}
        </ExternalLink>
        <p className="small-note">{t("glovoHint")}</p>
        <p className="allergy-note">{t("allergy")}</p>
      </div>
    </Modal>
  );
}

function VisitModal({
  locationId,
  locale,
  onClose,
}: {
  locationId: string;
  locale: Locale;
  onClose: () => void;
}) {
  const { locations } = usePublicContent();
  const { t } = useTranslation();
  const [location, setLocation] = useState(locationId),
    [date, setDate] = useState(localDate()),
    [time, setTime] = useState("19:00"),
    [saved, setSaved] = useState(false);
  const loc = locations.find((l) => l.id === location) ?? locations[0];
  const save = () => {
    if (!loc) return;
    const body = makeVisitCalendar({
      date,
      time,
      title: t("visitEvent"),
      address: loc.address[locale],
      description: t("visitEventNote"),
      url: loc.map,
    });
    const url = URL.createObjectURL(
      new Blob([body], { type: "text/calendar;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `lma3louma-${date}.ics`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setSaved(true);
  };
  if (!loc) return null;
  return (
    <Modal title={t("visitTitle")} onClose={onClose}>
      <form
        className="visit-modal"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <span className="modal-icon">
          <CalendarDays size={30} />
        </span>
        <h2>{t("visitTitle")}</h2>
        <p>{t("visitNote")}</p>
        <div className="field">
          <span>{t("restaurant")}</span>
          <Select
            label={t("restaurant")}
            value={location}
            onChange={(v) => {
              setLocation(v);
              setSaved(false);
            }}
            options={locations.map((l) => ({
              value: l.id,
              label: l.name[locale],
            }))}
          />
        </div>
        <div className="visit-date-row">
          <DatePicker
            label={t("date")}
            value={date}
            onChange={(v) => {
              setDate(v);
              setSaved(false);
            }}
            min={localDate()}
          />
          <TimePicker
            label={t("time")}
            value={time}
            onChange={(v) => {
              setTime(v);
              setSaved(false);
            }}
          />
        </div>
        <p className="small-note">{t("visitHours")}</p>
        <Button type="submit" className="full-width">
          <CalendarDays size={17} />
          {t("saveCalendar")}
        </Button>
        {saved && (
          <p className="success" role="status">
            <Check size={18} />
            {t("visitSaved")}
          </p>
        )}
        <ExternalLink href={loc.map} className="button--secondary full-width">
          {t("maps")}
        </ExternalLink>
      </form>
    </Modal>
  );
}

function ComponentGallery({
  motion,
  setMotion,
  locale,
  setLang,
}: {
  motion: boolean;
  setMotion: (v: boolean) => void;
  locale: Locale;
  setLang: (v: Locale) => void;
}) {
  const { locations } = usePublicContent();
  const { t } = useTranslation();
  const [value, setValue] = useState(""),
    [choice, setChoice] = useState("maarif"),
    [date, setDate] = useState(localDate()),
    [time, setTime] = useState("19:00");
  return (
    <section className="section container component-gallery">
      <p className="eyebrow">DESIGN SYSTEM</p>
      <h1>{t("componentTitle")}</h1>
      <p>{t("componentDesc")}</p>
      <div className="component-grid">
        <article>
          <h2>Button</h2>
          <Button onClick={() => setValue(t("name"))}>
            {t("discover")}
            <ArrowRight size={18} />
          </Button>
          <Button variant="secondary" onClick={() => setValue("")}>
            {t("reset")}
          </Button>
          <Button disabled>{t("order")}</Button>
        </article>
        <article>
          <h2>Input</h2>
          <Input
            label={t("name")}
            placeholder={t("name")}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </article>
        <article>
          <h2>Select</h2>
          <Select
            label={t("selectExample")}
            value={choice}
            onChange={setChoice}
            options={locations.map((l) => ({
              value: l.id,
              label: l.name[locale],
            }))}
          />
        </article>
        <article>
          <h2>Dropdown</h2>
          <Dropdown value={locale} onChange={setLang} />
        </article>
        <article>
          <h2>Date picker</h2>
          <DatePicker
            label={t("date")}
            value={date}
            onChange={setDate}
            min={localDate()}
          />
        </article>
        <article>
          <h2>Time picker</h2>
          <TimePicker label={t("time")} value={time} onChange={setTime} />
        </article>
        <article>
          <h2>Toggle</h2>
          <Toggle
            label={t("toggleExample")}
            checked={motion}
            onChange={setMotion}
          />
        </article>
      </div>
    </section>
  );
}
