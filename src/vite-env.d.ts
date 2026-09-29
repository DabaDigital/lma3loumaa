/// <reference types="vite/client" />
import "react";

declare module "react" {
  // Element Timing, which the prerendered page's loader reads to learn when
  // the hero photo is on screen (scripts/prerender.mjs).
  interface ImgHTMLAttributes<T> {
    elementtiming?: string;
  }
}
