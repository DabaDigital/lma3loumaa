import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { Star, MessageSquare, RefreshCw } from "lucide-react";
import { Button, Modal } from "./components";
import type { Locale } from "./data";
import { ReviewPhoto } from "./ReviewPhoto";
import { useReviewList } from "./reviews";
import { reviewCopy } from "./reviewCopy";
import { ContentSkeleton } from "./Skeleton";

const ReviewForm = lazy(() => import("./ReviewForm"));

export function Reviews() {
  const { i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage || "fr") as Locale;
  const t = (key: keyof typeof reviewCopy) => reviewCopy[key][locale];
  const { reviews, loading, error, refresh } = useReviewList();
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(6);
  return (
    <section
      className="reviews-section section"
      id="reviews"
      aria-labelledby="reviews-title"
    >
      <div className="container">
        <div className="reviews-heading">
          <div>
            <p className="eyebrow">{t("eyebrow")}</p>
            <h2 id="reviews-title">{t("title")}</h2>
            <p>{t("intro")}</p>
          </div>
          <Button onClick={() => setOpen(true)}>
            <MessageSquare size={17} />
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
            <div className="reviews-grid">
              {reviews.slice(0, visible).map((review) => (
                <article className="review-card" key={review.id}>
                  <ReviewPhoto path={review.image_path} alt={review.title} />
                  <div className="review-card-copy">
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
                      <time dateTime={review.created_at}>
                        {new Intl.DateTimeFormat(locale, {
                          dateStyle: "medium",
                        }).format(new Date(review.created_at))}
                      </time>
                    </div>
                    <h3 dir="auto">{review.title}</h3>
                    {review.description && (
                      <p dir="auto">{review.description}</p>
                    )}
                  </div>
                </article>
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
