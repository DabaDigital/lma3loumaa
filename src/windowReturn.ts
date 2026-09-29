/**
 * Calls `callback` when the visitor comes back to the page (the window
 * regains focus), to refresh what may have changed meanwhile. Focus that
 * only returns from one of the page's own players (a reel or a post from
 * Instagram, Facebook or TikTok) is not a return: the visitor never left, and
 * every click inside a player used to download the site's data again.
 * Returns the cleanup.
 */
export function onWindowReturn(callback: () => void) {
  let inFrame = false;
  let timer: number | undefined;
  // A click inside a cross-origin frame blurs this window; the frame becomes
  // the active element just after.
  const onBlur = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      inFrame = document.activeElement instanceof HTMLIFrameElement;
    });
  };
  const onFocus = () => {
    window.clearTimeout(timer);
    if (inFrame) inFrame = false;
    else callback();
  };
  // Leaving the tab, even from inside a player, is a real departure.
  const onVisibility = () => {
    if (document.hidden) inFrame = false;
  };
  window.addEventListener("blur", onBlur);
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    window.clearTimeout(timer);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
