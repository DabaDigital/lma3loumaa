import { useCallback, useState } from "react";
import type { ImgHTMLAttributes } from "react";
import imageAssets from "./imageAssets.json";

type Props = ImgHTMLAttributes<HTMLImageElement>;

function ImageState({ className = "", onLoad, onError, ...props }: Props) {
  const [settled, setSettled] = useState(false);
  const imageRef = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete) setSettled(true);
  }, []);
  return (
    <img
      decoding="async"
      {...props}
      ref={imageRef}
      className={`${className} ${settled ? "" : "skeleton-image"}`.trim()}
      onLoad={(event) => {
        setSettled(true);
        onLoad?.(event);
      }}
      onError={(event) => {
        setSettled(true);
        onError?.(event);
      }}
    />
  );
}

export function LoadingImage(props: Props) {
  // Only replace bundled, unversioned images. Uploaded/remote images and an
  // explicit srcSet continue to use the caller's exact source.
  let source = props.src || "";
  try {
    const url = new URL(source, window.location.origin);
    source =
      url.origin === window.location.origin && !url.search && !url.hash
        ? decodeURIComponent(url.pathname)
        : "";
  } catch {
    source = "";
  }
  const asset = !props.srcSet
    ? (
        imageAssets as Record<
          string,
          { src: string; srcSet: string; width: number; height: number }
        >
      )[source]
    : undefined;
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
    />
  );
}
