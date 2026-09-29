import { LoadingImage } from "./LoadingImage";
import { useEffect, useRef, useState } from "react";
import { ImageIcon, ImageOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "./supabase";
import { REVIEW_BUCKET } from "./reviews";

const THUMBNAIL = {
  width: 240,
  height: 240,
  resize: "cover",
  quality: 70,
} as const;

export function ReviewPhoto({
  path,
  alt,
  className = "",
  width,
  thumbnail = false,
}: {
  path: string | null;
  alt: string;
  className?: string;
  /** Download a resized copy this wide instead of the original upload. */
  width?: number;
  /** A small square crop, downloaded once near the viewport. It never falls
   *  back to the full-size original, which can weigh several megabytes. */
  thumbnail?: boolean;
}) {
  const [photo, setPhoto] = useState<{ path: string; url: string } | null>(
    null,
  );
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(!thumbnail);
  const frame = useRef<HTMLDivElement>(null);
  const { i18n } = useTranslation();
  useEffect(() => {
    if (visible || !frame.current) return;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, [visible]);
  useEffect(() => {
    if (!path || !supabase || !visible) return;
    let active = true;
    let objectUrl: string | undefined;
    setPhoto(null);
    setFailed(false);
    // Supabase only converts a resized photo to WebP for requests that accept
    // it, and fetch() accepts anything: a 1200px render came back as a PNG of
    // well over a megabyte.
    const bucket = supabase.storage
      .from(REVIEW_BUCKET)
      .setHeader("Accept", "image/webp,*/*");
    const original = () => bucket.download(path, {}, { cache: "no-store" });
    const transform = thumbnail
      ? THUMBNAIL
      : width
        ? { width, resize: "contain" as const, quality: 75 }
        : null;
    // Fall back to the original if Supabase cannot resize a full-size view.
    void (
      transform
        ? bucket
            .download(path, { transform }, { cache: "no-store" })
            .then((result) =>
              result.error && !thumbnail ? original() : result,
            )
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
  }, [path, width, thumbnail, visible]);
  if (!path) return null;
  const unavailable =
    i18n.resolvedLanguage === "ar"
      ? "الصورة غير متاحة"
      : i18n.resolvedLanguage === "en"
        ? "Photo unavailable"
        : "Photo indisponible";
  return (
    <div ref={frame} className={`review-photo ${className}`}>
      {photo?.path === path && !failed ? (
        <LoadingImage
          src={photo.url}
          alt={alt}
          onError={() => setFailed(true)}
        />
      ) : failed && thumbnail ? (
        // The full-size photo can still open from the thumbnail's button.
        <span aria-hidden="true">
          <ImageIcon size={24} />
        </span>
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
