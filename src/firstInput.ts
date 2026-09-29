const intents = [
  "scroll",
  "wheel",
  "touchstart",
  "pointerdown",
  "pointermove",
  "keydown",
] as const;

/** Calls `callback` once, on the visitor's first scroll, touch, key or mouse
 * movement. Work that only matters once someone uses the page waits for it
 * instead of competing with the page load. Returns the cleanup. */
export function onFirstInput(callback: () => void) {
  const stop = () => {
    for (const type of intents) window.removeEventListener(type, run);
  };
  const run = () => {
    stop();
    callback();
  };
  for (const type of intents)
    window.addEventListener(type, run, { passive: true });
  return stop;
}
