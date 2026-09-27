import { LoadingImage } from "./LoadingImage";
import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "./supabase";
import { REVIEW_BUCKET } from "./reviews";

export function ReviewPhoto({
  path,
  alt,
  className = "",
  width,
}: {
  path: string | null;
  alt: string;
  className?: string;
  /** Download a resized copy this wide instead of the original upload. */
  width?: number;
}) {
  const [photo, setPhoto] = useState<{ path: string; url: string } | null>(
    null,
  );
  const [failed, setFailed] = useState(false);
  const { i18n } = useTranslation();
  useEffect(() => {
    if (!path || !supabase) return;
    let active = true;
    let objectUrl: string | undefined;
    setPhoto(null);
    setFailed(false);
    const bucket = supabase.storage.from(REVIEW_BUCKET);
    const original = () => bucket.download(path, {}, { cache: "no-store" });
    // Fall back to the original if Supabase cannot resize it.
    void (
      width
        ? bucket
            .download(
              path,
              { transform: { width, resize: "contain", quality: 75 } },
              { cache: "no-store" },
            )
            .then((result) => (result.error ? original() : result))
        : original()
    )
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data) {
          setFailed(true);
          return;
        }
        objectUrl = URL.createObjectURL(data);
        setPhoto({ path, url: objectUrl });
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, width]);
  if (!path) return null;
  const unavailable =
    i18n.resolvedLanguage === "ar"
      ? "الصورة غير متاحة"
      : i18n.resolvedLanguage === "en"
        ? "Photo unavailable"
        : "Photo indisponible";
  return (
    <div className={`review-photo ${className}`}>
      {photo?.path === path && !failed ? (
        <LoadingImage
          src={photo.url}
          alt={alt}
          onError={() => setFailed(true)}
        />
      ) : failed ? (
        <span role="img" aria-label={unavailable}>
          <ImageOff size={24} />
          <small>{unavailable}</small>
        </span>
      ) : (
        <span className="review-photo-loading" aria-hidden="true" />
      )}
    </div>
  );
}
