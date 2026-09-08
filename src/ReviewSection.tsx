import { LoadingImage } from "./LoadingImage";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  Star,
  MessageSquare,
  ArrowUpRight,
  CheckCircle2,
  Upload,
  X,
  RefreshCw,
} from "lucide-react";
import { Button, Modal } from "./components";
import { supabase } from "./supabase";
import type { Locale } from "./data";
import { ReviewPhoto } from "./ReviewPhoto";
import {
  REVIEW_BUCKET,
  REVIEW_IMAGE_TYPES,
  REVIEW_MAX_BYTES,
  submitReview,
  useReviewList,
} from "./reviews";
import { reviewCopy } from "./reviewCopy";
import { ContentSkeleton } from "./Skeleton";

function ReviewForm({
  locale,
  onClose,
}: {
  locale: Locale;
  onClose: () => void;
}) {
  const t = (key: keyof typeof reviewCopy) => reviewCopy[key][locale];
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rating, setRating] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [photoError, setPhotoError] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const sending = useRef(false);
  const uploaded = useRef<{ file: File; id: string; path: string } | null>(
    null,
  );
  const attemptId = useRef(crypto.randomUUID());
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const pickPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0] ?? null;
    setPhotoError(false);
    setError("");
    if (
      next &&
      (!REVIEW_IMAGE_TYPES.includes(next.type) ||
        next.size > REVIEW_MAX_BYTES ||
        !next.size)
    ) {
      setFile(null);
      event.target.value = "";
      setPhotoError(true);
      return;
    }
    if (next !== file) attemptId.current = crypto.randomUUID();
    setFile(next);
  };
  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (sending.current) return;
    setError("");
    if (!supabase) {
      setError(t("unavailable"));
      return;
    }
    if (
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5 ||
      !title.trim() ||
      title.trim().length > 100 ||
      description.trim().length > 1500
    ) {
      setError(t("formError"));
      return;
    }
    if (photoError) return;
    sending.current = true;
    setBusy(true);
    try {
      let id: string = attemptId.current;
      let image_path: string | null = null;
      if (file) {
        if (uploaded.current?.file === file) {
          ({ id, path: image_path } = uploaded.current);
        } else {
          const extension =
            file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
          image_path = `${id}/photo.${extension}`;
          const { error: uploadError } = await supabase.storage
            .from(REVIEW_BUCKET)
            .upload(image_path, file, {
              contentType: file.type,
              upsert: false,
              cacheControl: "0",
            });
          if (uploadError) throw uploadError;
          uploaded.current = { file, id, path: image_path };
        }
      }
      await submitReview({
        id,
        title: title.trim(),
        description: description.trim(),
        rating,
        image_path,
      });
      setSuccess(true);
    } catch {
      setError(t("sendError"));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  return (
    <Modal
      title={t("formTitle")}
      onClose={() => {
        if (!sending.current) onClose();
      }}
      className="review-modal"
    >
      {success ? (
        <div className="review-success" role="status">
          <CheckCircle2 size={42} />
          <h3>{t("success")}</h3>
          <Button onClick={onClose}>{t("done")}</Button>
        </div>
      ) : (
        <>
          <p className="eyebrow">LMA3LOUMA · {t("eyebrow")}</p>
          <h3>{t("formTitle")}</h3>
          <p className="review-moderation">{t("moderation")}</p>
          <form onSubmit={send} noValidate>
            <fieldset disabled={busy} className="review-form-fields">
              <fieldset className="review-rating-input">
                <legend>
                  {t("rating")} <span aria-hidden="true">*</span>
                </legend>
                <div className="review-stars">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <label
                      key={value}
                      className={value <= rating ? "selected" : ""}
                    >
                      <input
                        type="radio"
                        name="review-rating"
                        value={value}
                        checked={rating === value}
                        onChange={() => setRating(value)}
                        required
                        aria-label={`${value} ${t(value === 1 ? "star" : "stars")}`}
                      />
                      <Star size={30} aria-hidden="true" />
                    </label>
                  ))}
                  <span aria-hidden="true">
                    {rating ? `${rating} / 5` : "— / 5"}
                  </span>
                </div>
              </fieldset>
              <div className="review-field">
                <label htmlFor="review-title">{t("fieldTitle")}</label>
                <input
                  id="review-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                  required
                  placeholder={t("titlePlaceholder")}
                />
              </div>
              <div className="review-field">
                <label htmlFor="review-description">
                  {t("fieldDescription")}
                </label>
                <textarea
                  id="review-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={1500}
                  rows={4}
                  placeholder={t("descriptionPlaceholder")}
                />
                <small>{description.length} / 1500</small>
              </div>
              <div className="review-field review-upload">
                <label htmlFor="review-photo">{t("photo")}</label>
                <span id="review-photo-help">
                  <Upload size={18} />
                  {t("photoHelp")}
                </span>
                <input
                  id="review-photo"
                  ref={fileInput}
                  type="file"
                  accept={REVIEW_IMAGE_TYPES.join(",")}
                  aria-describedby="review-photo-help"
                  onChange={pickPhoto}
                />
              </div>
              {photoError && (
                <p className="review-error" role="alert">
                  {t("photoError")}
                </p>
              )}
              {preview && (
                <div className="review-preview">
                  <LoadingImage src={preview} alt={t("photo")} />
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setPhotoError(false);
                      attemptId.current = crypto.randomUUID();
                      if (fileInput.current) fileInput.current.value = "";
                    }}
                    aria-label={t("removePhoto")}
                  >
                    <X size={18} />
                  </button>
                </div>
              )}
              {error && (
                <p className="review-error" role="alert">
                  {error}
                </p>
              )}
              {!supabase && (
                <p className="review-error" role="status">
                  {t("unavailable")}
                </p>
              )}
              <Button
                type="submit"
                disabled={!supabase || busy || photoError}
                className="full-width"
              >
                {busy ? t("sending") : t("submit")}
                <ArrowUpRight size={18} />
              </Button>
            </fieldset>
          </form>
        </>
      )}
    </Modal>
  );
}

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
      {open && <ReviewForm locale={locale} onClose={() => setOpen(false)} />}
    </section>
  );
}
