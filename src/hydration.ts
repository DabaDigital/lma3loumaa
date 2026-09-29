/** True from hydrating the prerendered home page (src/main.tsx) until the first
 * client-side navigation (src/router.ts). That page is laid out and painted
 * before the app starts, and nothing scrolls it programmatically, so layout
 * effects on it can leave their first measurement to a ResizeObserver (whose
 * initial callback still comes before the next paint) instead of forcing a
 * layout while the page loads. A page rendered by a navigation, which scrolls
 * to a section as soon as it has rendered, measures at once. */
let prerendered = false;

export const onPrerenderedPage = () => prerendered;

export function setPrerenderedPage(value: boolean) {
  prerendered = value;
}
