import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Star, ArrowUpRight, CheckCircle2, Upload, X } from "lucide-react";
import { LoadingImage } from "./LoadingImage";
import { Button, Modal } from "./components";
import { supabase } from "./supabase";
import type { Locale } from "./data";
import { REVIEW_IMAGE_TYPES, REVIEW_MAX_BYTES, reviewRequest } from "./reviews";
import type { ReviewPreparation } from "./reviews";
import { reviewCopy } from "./reviewCopy";
import { ReviewCaptcha } from "./ReviewCaptcha";

export default function ReviewForm({
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
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaReset, setCaptchaReset] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const sending = useRef(false);
  const prepared = useRef<{
    signature: string;
    file: File | null;
    data: ReviewPreparation;
    uploaded: boolean;
  } | null>(null);
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
    if (photoError || dailyLimit) return;
    const signature = JSON.stringify([
      title.trim(),
      description.trim(),
      rating,
    ]);
    if (
      prepared.current &&
      (prepared.current.signature !== signature ||
        prepared.current.file !== file)
    ) {
      prepared.current = null;
      attemptId.current = crypto.randomUUID();
    }
    if (!prepared.current && !captchaToken) {
      setError(t("captchaRequired"));
      return;
    }
    sending.current = true;
    setBusy(true);
    try {
      if (!prepared.current) {
        const data = await reviewRequest({
          action: "prepare",
          id: attemptId.current,
          title: title.trim(),
          description: description.trim(),
          rating,
          imageType: file?.type ?? null,
          imageSize: file?.size ?? 0,
          captchaToken,
        });
        prepared.current = { signature, file, data, uploaded: !!data.uploaded };
      }
      const submission = prepared.current;
      if (submission.data.completed) {
        setSuccess(true);
        return;
      }
      if (file && !submission.uploaded) {
        if (!submission.data.upload) throw new Error("UNAVAILABLE");
        const { path, token } = submission.data.upload;
        const { error: uploadError } = await supabase.storage
          .from("review-uploads")
          .uploadToSignedUrl(path, token, file, {
            contentType: file.type,
            cacheControl: "0",
          });
        if (uploadError) {
          // The upload may have reached Storage even if its response was lost.
          // Ask the verified endpoint to recover the same immutable attempt.
          prepared.current = null;
          throw uploadError;
        }
        submission.uploaded = true;
      }
      await reviewRequest({ action: "complete", id: submission.data.id });
      setSuccess(true);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "";
      if (code === "DAILY_LIMIT") {
        setDailyLimit(true);
        setError(t("dailyLimit"));
      } else if (code === "CAPTCHA_FAILED") setError(t("captchaRequired"));
      else if (code === "EXPIRED" || code === "CONFLICT") {
        prepared.current = null;
        attemptId.current = crypto.randomUUID();
        setError(t("submissionExpired"));
      } else setError(t("sendError"));
      setCaptchaToken("");
      setCaptchaReset((n) => n + 1);
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
              <p className="review-daily-help">{t("dailyHelp")}</p>
              {supabase && (
                <ReviewCaptcha
                  locale={locale}
                  reset={captchaReset}
                  onToken={setCaptchaToken}
                />
              )}
              {!supabase && (
                <p className="review-error" role="status">
                  {t("unavailable")}
                </p>
              )}
              <Button
                type="submit"
                disabled={!supabase || busy || photoError || dailyLimit}
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
