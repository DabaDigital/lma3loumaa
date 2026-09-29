import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Star,
  RefreshCw,
  CirclePlus,
  UserRound,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Clock3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button, Modal } from "./components";
import type { Locale } from "./data";
import { ReviewPhoto } from "./ReviewPhoto";
import {
  REVIEW_PAGE_SIZE,
  usePublicReviews,
  type Review,
  type ReviewSort,
  type ReviewStats,
} from "./reviews";
import { reviewCopy } from "./reviewCopy";
import { ContentSkeleton } from "./Skeleton";

const ReviewForm = lazy(() => import("./ReviewForm"));

// Creating Intl formatters is slow (locale data loads on first use), so each
// language builds its set once instead of on every call and render.
const formatterSets = new Map<Locale, ReturnType<typeof createFormatters>>();
function createFormatters(locale: Locale) {
  // Western digits, as used on Moroccan menus and receipts.
  const tag = locale === "ar" ? "ar-u-nu-latn" : locale;
  const number = new Intl.NumberFormat(tag);
  const oneDecimal = new Intl.NumberFormat(tag, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return {
    format: (value: number) => number.format(value),
    decimal: (value: number) => oneDecimal.format(value),
    date: new Intl.DateTimeFormat(tag, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    pluralRules: new Intl.PluralRules(tag),
  };
}
function formatters(locale: Locale) {
  let set = formatterSets.get(locale);
  if (!set) formatterSets.set(locale, (set = createFormatters(locale)));
  return set;
}

type Copy = (key: keyof typeof reviewCopy) => string;
type Format = (value: number) => string;

const SORTS: [ReviewSort, keyof typeof reviewCopy, LucideIcon][] = [
  ["all", "sortAll", LayoutGrid],
  ["recent", "sortRecent", Clock3],
  ["top", "sortTop", Star],
];

const fill = (text: string, values: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match);

function Stars({
  rating,
  label,
  size = 16,
}: {
  rating: number;
  label: string;
  size?: number;
}) {
  return (
    <span className="review-stars-display" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          aria-hidden="true"
          className={n <= Math.round(rating) ? "is-filled" : undefined}
        />
      ))}
    </span>
  );
}

function starsLabel(n: number, t: Copy, format: Format) {
  const key = n === 1 ? "starLabel" : n === 2 ? "starsTwo" : "starsLabel";
  return fill(t(key), { n: format(n) });
}

/** Page numbers around the current one, with gaps for long runs. */
function pageItems(page: number, count: number): (number | "gap")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const shown = new Set([1, count, page - 1, page, page + 1]);
  if (page <= 4) [2, 3, 4, 5].forEach((n) => shown.add(n));
  if (page >= count - 3) [1, 2, 3, 4].forEach((n) => shown.add(count - n));
  const pages = [...shown].filter((n) => n >= 1 && n <= count);
  pages.sort((a, b) => a - b);
  const items: (number | "gap")[] = [];
  pages.forEach((n, i) => {
    if (i && n - pages[i - 1] > 1) items.push("gap");
    items.push(n);
  });
  return items;
}

function RatingSummary({
  stats,
  t,
  format,
  decimal,
  pluralRules,
}: {
  stats: ReviewStats;
  t: Copy;
  format: Format;
  decimal: Format;
  pluralRules: Intl.PluralRules;
}) {
  const average = stats.average ?? 0;
  const verdict =
    average >= 4.5
      ? "verdictExcellent"
      : average >= 4
        ? "verdictGreat"
        : average >= 3
          ? "verdictGood"
          : "verdictNeutral";
  const plural = pluralRules.select(stats.total);
  const countKey =
    plural === "one"
      ? "countOne"
      : plural === "two"
        ? "countTwo"
        : plural === "few"
          ? "countFew"
          : plural === "many"
            ? "countMany"
            : "countOther";
  return (
    <section className="reviews-summary" aria-label={t("summary")}>
      <div className="reviews-score">
        <strong dir="ltr">{decimal(average)}</strong>
        <Stars
          rating={average}
          size={24}
          label={`${decimal(average)} ${t("outOf")}`}
        />
        <p>({fill(t(countKey), { n: format(stats.total) })})</p>
      </div>
      <div className="reviews-verdict">
        <ShieldCheck size={54} strokeWidth={1.6} aria-hidden="true" />
        <div>
          <h3>{t(verdict)}</h3>
          <p>{t(average >= 3 ? "verdictProud" : "verdictListening")}</p>
        </div>
      </div>
      <ul className="reviews-breakdown" aria-label={t("breakdown")}>
        {[5, 4, 3, 2, 1].map((n) => {
          const count = stats.counts[n - 1];
          const share = stats.total ? (count / stats.total) * 100 : 0;
          const percent =
            count && share < 1 ? "<1%" : `${format(Math.round(share))}%`;
          return (
            <li key={n}>
              <span className="reviews-breakdown-label">
                <span aria-hidden="true">{format(n)}</span>
                <Star size={15} aria-hidden="true" />
                <span className="sr-only">{starsLabel(n, t, format)}</span>
              </span>
              <span className="reviews-breakdown-track" aria-hidden="true">
                <span
                  className={count ? "has-reviews" : undefined}
                  style={{ inlineSize: `${share}%` }}
                />
              </span>
              <span className="reviews-breakdown-value" dir="ltr">
                {percent}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Avatar, title, stars and date: shared by the card and its popup. */
function ReviewByline({
  review,
  t,
  format,
  date,
  children,
}: {
  review: Review;
  t: Copy;
  format: Format;
  date: Intl.DateTimeFormat;
  children: ReactNode;
}) {
  return (
    <header className="review-byline">
      <span className="review-avatar" aria-hidden="true">
        <UserRound size={22} />
      </span>
      <div>
        {children}
        <div className="review-meta">
          <Stars
            rating={review.rating}
            label={starsLabel(review.rating, t, format)}
          />
          <time dateTime={review.created_at}>
            {date.format(new Date(review.created_at))}
          </time>
        </div>
      </div>
    </header>
  );
}

function ReviewCard({
  review,
  t,
  format,
  date,
  onOpen,
}: {
  review: Review;
  t: Copy;
  format: Format;
  date: Intl.DateTimeFormat;
  onOpen: (review: Review) => void;
}) {
  const titleId = useId();
  return (
    <article className="review-card" aria-labelledby={titleId}>
      <div className="review-card-main">
        <ReviewByline review={review} t={t} format={format} date={date}>
          <h3 id={titleId} dir="auto">
            {/* Stretched over the whole card: any tap opens the full review. */}
            <button
              type="button"
              className="review-card-open"
              aria-haspopup="dialog"
              onClick={() => onOpen(review)}
            >
              <span>{review.title}</span>
            </button>
          </h3>
        </ReviewByline>
        {review.description && <p dir="auto">{review.description}</p>}
      </div>
      {review.image_path && (
        <ReviewPhoto
          path={review.image_path}
          alt=""
          thumbnail
          className="review-thumb"
        />
      )}
    </article>
  );
}

function Pagination({
  page,
  pageCount,
  onChange,
  t,
  format,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  t: Copy;
  format: Format;
}) {
  return (
    <nav className="review-pagination" aria-label={t("pages")}>
      <button
        type="button"
        className="review-page-step"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft
          size={18}
          className="review-page-arrow"
          aria-hidden="true"
        />
        <span>{t("previous")}</span>
      </button>
      <ol className="review-pages">
        {pageItems(page, pageCount).map((item, index) =>
          item === "gap" ? (
            <li
              key={`gap-${index}`}
              className="review-page-gap"
              aria-hidden="true"
            >
              …
            </li>
          ) : (
            <li key={item}>
              <button
                type="button"
                className="review-page"
                aria-current={item === page ? "page" : undefined}
                aria-label={fill(t("pageLabel"), { page: format(item) })}
                onClick={() => item !== page && onChange(item)}
              >
                {format(item)}
              </button>
            </li>
          ),
        )}
      </ol>
      <p className="review-page-status">
        {fill(t("pageStatus"), {
          page: format(page),
          pages: format(pageCount),
        })}
      </p>
      <button
        type="button"
        className="review-page-step"
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
      >
        <span>{t("next")}</span>
        <ChevronRight
          size={18}
          className="review-page-arrow"
          aria-hidden="true"
        />
      </button>
    </nav>
  );
}

export function Reviews() {
  const { i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage || "ar") as Locale;
  const t: Copy = (key) => reviewCopy[key][locale];
  const { format, decimal, date, pluralRules } = formatters(locale);
  const [sort, setSort] = useState<ReviewSort>("all");
  const [requestedPage, setRequestedPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Review | null>(null);
  const section = useRef<HTMLElement>(null);
  const browser = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  // The reviews sit far down the page. Their seven requests wait until the
  // visitor comes within two screens of them, rather than joining the page
  // load.
  const [near, setNear] = useState(false);
  useEffect(() => {
    const element = section.current;
    if (near || !element) return;
    const approach = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        approach.disconnect();
        setNear(true);
      },
      { rootMargin: "200% 0px" },
    );
    approach.observe(element);
    return () => approach.disconnect();
  }, [near]);
  // Moderation can remove pages while a visitor is reading the last one.
  const [knownPages, setKnownPages] = useState(Infinity);
  const page = Math.min(requestedPage, knownPages);
  const { stats, reviews, pending, loading, error, refresh } = usePublicReviews(
    sort,
    page,
    near,
  );
  const total = stats?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / REVIEW_PAGE_SIZE));
  if (stats && pageCount !== knownPages) setKnownPages(pageCount);
  const goToPage = (next: number) => {
    setRequestedPage(next);
    list.current?.focus({ preventScroll: true });
    // Pagination sits below the list: bring its first reviews back into view.
    if (browser.current && browser.current.getBoundingClientRect().top < 100)
      browser.current.scrollIntoView({ block: "start" });
  };
  const first = (page - 1) * REVIEW_PAGE_SIZE + 1;
  const last = Math.min(page * REVIEW_PAGE_SIZE, total);
  const status = fill(t("pageStatus"), {
    page: format(page),
    pages: format(pageCount),
  });
  return (
    <section
      ref={section}
      className="reviews-section section"
      id="reviews"
      aria-labelledby="reviews-title"
    >
      <div className="container">
        <div className="reviews-intro">
          <p className="eyebrow">{t("eyebrow")}</p>
          <h2 id="reviews-title">
            {t("titleStart")}
            <span>{t("titleAccent")}</span>
            {t("titleEnd")}
          </h2>
          <p>{t("intro")}</p>
        </div>

        {loading ? (
          <div
            className="reviews-summary reviews-summary--loading"
            aria-hidden="true"
          />
        ) : (
          stats &&
          total > 0 && (
            <RatingSummary
              stats={stats}
              t={t}
              format={format}
              decimal={decimal}
              pluralRules={pluralRules}
            />
          )
        )}

        <div className="reviews-browser" ref={browser}>
          <div className="reviews-toolbar">
            {total > 1 && !error && (
              <div
                className="review-sorts"
                role="group"
                aria-label={t("sortLabel")}
              >
                {SORTS.map(([value, key, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    className="review-sort"
                    aria-pressed={sort === value}
                    onClick={() => {
                      setSort(value);
                      setRequestedPage(1);
                    }}
                  >
                    <Icon size={16} aria-hidden="true" />
                    {t(key)}
                  </button>
                ))}
              </div>
            )}
            <Button className="review-write" onClick={() => setOpen(true)}>
              <CirclePlus size={24} aria-hidden="true" />
              {t("write")}
            </Button>
          </div>

          {loading ? (
            <ContentSkeleton kind="reviews" />
          ) : error ? (
            <div className="review-empty">
              <p role="alert">{t("loadError")}</p>
              <Button variant="secondary" onClick={() => void refresh()}>
                <RefreshCw size={16} />
                {t("retry")}
              </Button>
            </div>
          ) : !total ? (
            <div className="review-empty">
              <div className="review-empty-stars" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} size={21} />
                ))}
              </div>
              <h3>{t("empty")}</h3>
              <p>{t("emptySub")}</p>
            </div>
          ) : (
            <>
              <div
                ref={list}
                className={`reviews-grid${pending ? " is-pending" : ""}`}
                tabIndex={-1}
                aria-busy={pending}
                aria-label={status}
              >
                {reviews.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    t={t}
                    format={format}
                    date={date}
                    onOpen={setSelected}
                  />
                ))}
              </div>
              {pageCount > 1 && (
                <Pagination
                  page={page}
                  pageCount={pageCount}
                  onChange={goToPage}
                  t={t}
                  format={format}
                />
              )}
              <p className="review-range" aria-live="polite">
                {pending
                  ? ""
                  : fill(t("showing"), {
                      from: format(first),
                      to: format(last),
                      total: format(total),
                    })}
              </p>
            </>
          )}
        </div>
      </div>
      {selected && (
        <Modal
          title={selected.title}
          onClose={() => setSelected(null)}
          className="review-detail-modal"
        >
          {selected.image_path && (
            <ReviewPhoto
              path={selected.image_path}
              alt={selected.title}
              width={1200}
            />
          )}
          <div className="review-detail">
            <ReviewByline review={selected} t={t} format={format} date={date}>
              <p className="review-detail-title" dir="auto">
                {selected.title}
              </p>
            </ReviewByline>
            {selected.description && <p dir="auto">{selected.description}</p>}
          </div>
        </Modal>
      )}
      {open && (
        <Suspense
          fallback={
            <Modal
              title={t("formTitle")}
              onClose={() => setOpen(false)}
              className="review-modal"
            >
              <h3>{t("formTitle")}</h3>
              <ContentSkeleton kind="login" />
            </Modal>
          }
        >
          <ReviewForm locale={locale} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </section>
  );
}
