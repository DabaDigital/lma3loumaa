import { lazy, Suspense, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Star,
  MessageSquare,
  RefreshCw,
  ImageIcon,
  ChevronDown,
  Quote,
  ArrowUpRight,
} from "lucide-react";
import { Button, Modal } from "./components";
import type { Locale } from "./data";
import { ReviewPhoto } from "./ReviewPhoto";
import { useReviewList, type Review } from "./reviews";
import { reviewCopy } from "./reviewCopy";
import { ContentSkeleton } from "./Skeleton";

const ReviewForm = lazy(() => import("./ReviewForm"));

function ReviewCard({
  review,
  locale,
  t,
  index,
}: {
  review: Review;
  locale: Locale;
  t: (key: keyof typeof reviewCopy) => string;
  index: number;
}) {
  const [photoOpen, setPhotoOpen] = useState(false);
  // Download the photo on first open, then keep it so closing can animate.
  const [photoRequested, setPhotoRequested] = useState(false);
  const photoId = useId();
  return (
    <article
      className={`review-card${index === 0 ? " review-card--featured" : ""}${photoOpen ? " is-photo-open" : ""}`}
    >
      <div className="review-card-body">
        <div className="review-note-header">
          <span>{t(index === 0 ? "latestNote" : "tableNote")}</span>
          <span className="review-note-number" aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>
        <div className="review-card-copy">
          <Quote className="review-quote-mark" aria-hidden="true" />
          <div className="review-card-meta">
            <span
              className="review-display-stars"
              role="img"
              aria-label={`${review.rating} / 5`}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  size={16}
                  fill={n <= review.rating ? "currentColor" : "none"}
                />
              ))}
            </span>
          </div>
          <h3 dir="auto">{review.title}</h3>
          {review.description && <p dir="auto">{review.description}</p>}
        </div>
        <div className="review-note-footer">
          <span className="review-note-brand" dir="ltr">
            LMA3LOUMA · CASA
          </span>
          <time dateTime={review.created_at}>
            {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
              new Date(review.created_at),
            )}
          </time>
        </div>
        {review.image_path && (
          <button
            type="button"
            className="review-photo-toggle"
            aria-expanded={photoOpen}
            aria-controls={photoId}
            onClick={() => {
              setPhotoRequested(true);
              setPhotoOpen((open) => !open);
            }}
          >
            <ImageIcon size={16} aria-hidden="true" />
            {t(photoOpen ? "hidePhoto" : "showPhoto")}
            <ChevronDown
              size={16}
              aria-hidden="true"
              className="review-photo-chevron"
            />
          </button>
        )}
      </div>
      {review.image_path && (
        <div id={photoId} className="review-photo-panel">
          <div>
            {photoRequested && (
              <ReviewPhoto
                path={review.image_path}
                alt={review.title}
                width={800}
              />
            )}
          </div>
        </div>
      )}
    </article>
  );
}

export function Reviews() {
  const { i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage || "ar") as Locale;
  const t = (key: keyof typeof reviewCopy) => reviewCopy[key][locale];
  const { reviews, loading, error, refresh } = useReviewList();
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(6);
  const average = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : null;
  return (
    <section
      className="reviews-section section"
      id="reviews"
      aria-labelledby="reviews-title"
    >
      <div className="container reviews-layout">
        <div className="reviews-heading">
          <div>
            <p className="eyebrow">{t("eyebrow")}</p>
            <h2 id="reviews-title">{t("title")}</h2>
            <p>{t("intro")}</p>
          </div>
          {!loading && !error && average !== null && (
            <div className="reviews-summary" aria-label={t("communityRating")}>
              <div className="reviews-summary-score">
                <Star size={24} fill="currentColor" aria-hidden="true" />
                <strong dir="ltr">
                  {new Intl.NumberFormat(locale, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  }).format(average)}
                </strong>
                <span dir="ltr">/ 5</span>
              </div>
              <p>
                <strong>{reviews.length}</strong>{" "}
                {t(reviews.length === 1 ? "sharedOne" : "shared")}
              </p>
            </div>
          )}
          <Button onClick={() => setOpen(true)}>
            <MessageSquare size={17} />
            {t("write")}
            <ArrowUpRight size={17} aria-hidden="true" />
          </Button>
        </div>
        <div className="reviews-wall">
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
          ) : !reviews.length ? (
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
                className={`reviews-grid${reviews.length === 1 ? " reviews-grid--single" : ""}`}
              >
                {reviews.slice(0, visible).map((review, index) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    locale={locale}
                    t={t}
                    index={index}
                  />
                ))}
              </div>
              {visible < reviews.length && (
                <div className="review-more">
                  <Button
                    variant="secondary"
                    onClick={() => setVisible((n) => n + 6)}
                  >
                    {t("more")}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
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
