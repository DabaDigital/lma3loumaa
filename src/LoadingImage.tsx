import { useCallback, useState } from "react";
import type { ImgHTMLAttributes } from "react";

type Props = ImgHTMLAttributes<HTMLImageElement>;

function ImageState({ className = "", onLoad, onError, ...props }: Props) {
  const [settled, setSettled] = useState(false);
  const imageRef = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete) setSettled(true);
  }, []);
  return (
    <img
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
  return (
    <ImageState key={`${props.src ?? ""}|${props.srcSet ?? ""}`} {...props} />
  );
}
