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
}: {
  path: string | null;
  alt: string;
  className?: string;
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
    void supabase.storage
      .from(REVIEW_BUCKET)
      .download(path, {}, { cache: "no-store" })
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
  }, [path]);
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
        <LoadingImage src={photo.url} alt={alt} onError={() => setFailed(true)} />
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
