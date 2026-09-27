// The site opens in Arabic; most specs assert French copy, so start with French saved.
export const frenchSaved = (origin: string) => ({
  cookies: [],
  origins: [{ origin, localStorage: [{ name: "lma-language", value: "fr" }] }],
});
