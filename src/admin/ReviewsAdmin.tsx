import { useRef, useState } from "react";
import { Check, MessageSquare, RefreshCw, Search, Star, X } from "lucide-react";
import { Button, Modal } from "../components";
import type { Locale } from "../data";
import { ReviewPhoto } from "../ReviewPhoto";
import { setReviewStatus, useReviewList } from "../reviews";
import type { Review } from "../reviews";
import { copy } from "./copy";
import { ContentSkeleton } from "../Skeleton";

const statusLabels = {
  pending: "reviewsPending",
  approved: "reviewsApproved",
  rejected: "reviewsRejected",
} as const;

export function ReviewsAdmin({ locale }: { locale: Locale }) {
  const t = (key: keyof typeof copy) => copy[key][locale];
  const { reviews, loading, error, refresh } = useReviewList(true);
  const [status, setStatus] = useState<Review["status"]>("pending");
  const [query, setQuery] = useState("");
  const [photoReview, setPhotoReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState(false);
  const [notice, setNotice] = useState<
    "reviewApproved" | "reviewRejected" | null
  >(null);
  const mutating = useRef(false);
  const dateFormat = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const filtered = reviews.filter(
    (review) =>
      review.status === status &&
      `${review.title} ${review.description}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );

  const moderate = async (id: string, next: "approved" | "rejected") => {
    if (mutating.current) return;
    mutating.current = true;
    setBusy(id);
    setFailure(false);
    setNotice(null);
    try {
      // The service verifies a row was actually updated before returning.
      await setReviewStatus(id, next);
      setNotice(next === "approved" ? "reviewApproved" : "reviewRejected");
      await refresh();
    } catch {
      setFailure(true);
    } finally {
      mutating.current = false;
      setBusy(null);
    }
  };

  return (
    <section className="admin-review-section" aria-label={t("reviews")}>
      <div className="admin-panel admin-review-toolbar">
        <div
          className="admin-review-filters"
          role="group"
          aria-label={t("reviewsFilter")}
        >
          {(["pending", "approved", "rejected"] as const).map((value) => (
            <button
              key={value}
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
            >
              {t(statusLabels[value])}
              <span>
                {reviews.filter((review) => review.status === value).length}
              </span>
            </button>
          ))}
        </div>
        <div className="admin-filters">
          <label className="admin-search">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              aria-label={t("reviewsSearch")}
              placeholder={t("reviewsSearch")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <Button
            variant="secondary"
            disabled={loading || !!busy}
            onClick={() => void refresh()}
          >
            <RefreshCw size={15} aria-hidden="true" />
            {t("reviewsRefresh")}
          </Button>
        </div>
      </div>
      {notice && (
        <p className="admin-notice" role="status">
          {t(notice)}
        </p>
      )}
      {failure && (
        <p className="admin-error" role="alert">
          {t("error")}
        </p>
      )}
      {error && (
        <div className="admin-error" role="alert">
          {t("loadError")}{" "}
          <button disabled={loading || !!busy} onClick={() => void refresh()}>
            {t("retry")}
          </button>
        </div>
      )}
      {loading ? (
        <ContentSkeleton kind="admin-reviews" />
      ) : !error && !filtered.length ? (
        <div className="admin-panel admin-empty">
          <MessageSquare size={28} aria-hidden="true" />
          <h2>{t("reviewsEmpty")}</h2>
          <p>{t("reviewsEmptyHelp")}</p>
        </div>
      ) : !error ? (
        <div className="admin-review-list">
          {filtered.map((review) => (
            <article
              className="admin-panel admin-review"
              key={review.id}
              aria-labelledby={`review-${review.id}`}
            >
              {review.image_path && (
                <div className="admin-review-photo">
                  <button
                    type="button"
                    className="admin-review-photo-button"
                    onClick={() => setPhotoReview(review)}
                    aria-label={`${t("image")} · ${review.title}`}
                  >
                    <ReviewPhoto
                      path={review.image_path}
                      alt={`${t("image")} · ${review.title}`}
                    />
                  </button>
                </div>
              )}
              <div className="admin-review-content">
                <div className="admin-review-meta">
                  <span className={`admin-review-status is-${review.status}`}>
                    {t(statusLabels[review.status])}
                  </span>
                  <time dateTime={review.created_at}>
                    {t("reviewSubmitted")}{" "}
                    {dateFormat.format(new Date(review.created_at))}
                  </time>
                </div>
                <h2 id={`review-${review.id}`} dir="auto">
                  {review.title}
                </h2>
                <div
                  className="admin-review-rating"
                  role="img"
                  aria-label={`${review.rating} ${t("reviewRating")}`}
                >
                  {Array.from({ length: 5 }, (_, index) => (
                    <Star
                      key={index}
                      size={16}
                      fill={index < review.rating ? "currentColor" : "none"}
                      aria-hidden="true"
                    />
                  ))}
                  <strong aria-hidden="true">{review.rating}/5</strong>
                </div>
                {review.description && (
                  <p className="admin-review-description" dir="auto">
                    {review.description}
                  </p>
                )}
              </div>
              <footer className="admin-review-actions">
                <Button
                  disabled={!!busy || review.status === "approved"}
                  aria-label={`${t("reviewsApprove")} · ${review.title}`}
                  onClick={() => void moderate(review.id, "approved")}
                >
                  <Check size={16} aria-hidden="true" />
                  {busy === review.id ? t("saving") : t("reviewsApprove")}
                </Button>
                <Button
                  variant="secondary"
                  className="admin-review-reject"
                  disabled={!!busy || review.status === "rejected"}
                  aria-label={`${t("reviewsReject")} · ${review.title}`}
                  onClick={() => void moderate(review.id, "rejected")}
                >
                  <X size={16} aria-hidden="true" />
                  {busy === review.id ? t("saving") : t("reviewsReject")}
                </Button>
              </footer>
            </article>
          ))}
        </div>
      ) : null}
      {photoReview && (
        <Modal
          title={photoReview.title}
          onClose={() => setPhotoReview(null)}
          className="admin-review-photo-modal"
        >
          <h2 dir="auto">{photoReview.title}</h2>
          <ReviewPhoto
            path={photoReview.image_path}
            alt={`${t("image")} · ${photoReview.title}`}
          />
        </Modal>
      )}
    </section>
  );
}
