/** The hero photo is the home page's largest paint. index.html preloads it with
 * these same values (see vite.config.ts), so the preload and the <img> choose
 * the same file and it downloads once, alongside the app bundle. */
export const heroPhoto = "/assets/shawarma_normal.png";
export const heroSizes =
  "(max-width: 600px) 100vw, (max-width: 1100px) 50vw, 600px";
