import { useCallback, useState } from "react";
import type { ImgHTMLAttributes } from "react";
import imageAssets from "./imageAssets.json";

type Props = ImgHTMLAttributes<HTMLImageElement>;

function ImageState({ className = "", onLoad, onError, ...props }: Props) {
  // Cached images show at once; downloaded ones stay behind the skeleton until
  // complete, then fade in rather than appearing half-drawn.
  const [state, setState] = useState<"loading" | "revealed" | "ready">(
    "loading",
  );
  const imageRef = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete) setState("ready");
  }, []);
  const stateClass =
    state === "loading"
      ? "skeleton-image"
      : state === "revealed"
        ? "image-reveal"
        : "";
  return (
    <img
      decoding="async"
      {...props}
      ref={imageRef}
      className={`${className} ${stateClass}`.trim()}
      onLoad={(event) => {
        setState((current) => (current === "loading" ? "revealed" : current));
        onLoad?.(event);
      }}
      onError={(event) => {
        setState("ready");
        onError?.(event);
      }}
    />
  );
}

type Asset = {
  src: string;
  srcSet: string;
  width?: number;
  height?: number;
  resized?: boolean;
};
const bundled = imageAssets as Record<string, Asset>;
let storageOrigin = "";
try {
  storageOrigin = new URL(import.meta.env.VITE_SUPABASE_URL).origin;
} catch {
  // No backend configured: only bundled images are optimized.
}
const storagePath = "/storage/v1/object/public/";

// Bundled, unversioned images use their generated WebP variants. Photos
// uploaded through the admin (1-3 MB originals) are resized by Supabase, which
// also serves WebP to browsers that accept it. Other remote images and an
// explicit srcSet keep the caller's exact source.
function optimized(source: string): Asset | undefined {
  try {
    const url = new URL(source, window.location.origin);
    if (url.search || url.hash) return undefined;
    if (url.origin === window.location.origin)
      return bundled[decodeURIComponent(url.pathname)];
    if (url.origin !== storageOrigin || !url.pathname.startsWith(storagePath))
      return undefined;
    const render = (width: number) =>
      `${url.origin}/storage/v1/render/image/public/${url.pathname.slice(storagePath.length)}` +
      `?width=${width}&resize=contain&quality=75`;
    return {
      src: render(768),
      srcSet: [384, 768, 1280]
        .map((width) => `${render(width)} ${width}w`)
        .join(", "),
      resized: true,
    };
  } catch {
    return undefined;
  }
}

export function LoadingImage(props: Props) {
  // If resizing is unavailable (e.g. the Supabase plan changes), fall back to
  // the original upload rather than showing a broken image.
  const [unresized, setUnresized] = useState<string>();
  const asset =
    props.srcSet || unresized === props.src
      ? undefined
      : optimized(props.src || "");
  const resolved = asset
    ? {
        ...props,
        src: asset.src,
        srcSet: asset.srcSet,
        sizes: props.sizes || "(max-width: 600px) 100vw, 600px",
        width: props.width ?? asset.width,
        height: props.height ?? asset.height,
      }
    : props;
  return (
    <ImageState
      key={`${resolved.src ?? ""}|${resolved.srcSet ?? ""}`}
      {...resolved}
      onError={(event) => {
        if (asset?.resized) setUnresized(props.src);
        else props.onError?.(event);
      }}
    />
  );
}
