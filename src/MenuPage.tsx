import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Flame,
  Heart,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { Button, FoodVisual, Input, Select, Toggle } from "./components";
import { ContentSkeleton } from "./Skeleton";
import { navigate, useLocation } from "./router";
import type { Item, Locale, Localized } from "./data";

export type MenuPageProps = {
  items: Item[];
  categories: { id: string; name: Localized; icon?: string }[];
  locale: Locale;
  loading: boolean;
  combo: boolean;
  onComboChange: (value: boolean) => void;
  onSelect: (item: Item) => void;
};

const back = {
  ar: "رجع للنكهات",
  fr: "Revenir aux saveurs",
  en: "Back to the flavors",
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ًͯ-ٟ]/g, "")
    .replace(/[أإآ]/g, "ا");

/** The full menu on its own page. The category lives in the address, so a
 * link such as /menu?category=mezze opens straight on that tab. */
export function MenuPage({
  items,
  categories,
  locale,
  loading,
  combo,
  onComboChange,
  onSelect,
}: MenuPageProps) {
  const { t } = useTranslation();
  const { searchParams } = useLocation();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recommended");
  const requested = searchParams.get("category");
  const category = categories.some((entry) => entry.id === requested)
    ? requested!
    : "all";
  const price = (item: Item) =>
    combo && item.menuPrice != null ? item.menuPrice : item.price;
  const priceLabel = (item: Item) =>
    item.variants?.length
      ? t("from")
      : combo && item.menuPrice != null
        ? t("meal")
        : t("single");
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
  const changeCategory = (id: string) =>
    navigate(id === "all" ? "/menu" : `/menu?category=${id}`, {
      replace: true,
    });

  return (
    <section className="menu-page">
      <div className="menu-catalog container">
        <div className="menu-catalog-heading">
          <h1>{t("menu")}</h1>
          <a href="/#menu" className="text-button">
            {locale === "ar" ? (
              <ArrowRight size={18} aria-hidden="true" />
            ) : (
              <ArrowLeft size={18} aria-hidden="true" />
            )}
            {back[locale]}
          </a>
        </div>
        {loading ? (
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
                onChange={(event) => setQuery(event.target.value)}
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
                    setQuery("");
                    changeCategory("all");
                  }}
                >
                  {t("allMenu")}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
