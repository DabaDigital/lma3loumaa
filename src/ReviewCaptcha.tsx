import { useEffect, useRef, useState } from "react";
import type { Locale } from "./data";
import { reviewCopy } from "./reviewCopy";

type Turnstile = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}
let scriptPromise: Promise<Turnstile> | null = null;
function loadScript() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    const fail = () => {
      clearTimeout(timer);
      script.remove();
      scriptPromise = null;
      reject(new Error("CAPTCHA_UNAVAILABLE"));
    };
    const timer = window.setTimeout(fail, 15000);
    script.onerror = fail;
    script.onload = () => {
      clearTimeout(timer);
      if (window.turnstile) resolve(window.turnstile);
      else fail();
    };
    document.head.append(script);
  });
  return scriptPromise;
}

export function ReviewCaptcha({
  locale,
  reset,
  onToken,
}: {
  locale: Locale;
  reset: number;
  onToken: (token: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [issue, setIssue] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [compact, setCompact] = useState(() => window.innerWidth < 400);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setCompact(entry.contentRect.width < 300),
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let active = true;
    let widget: string | undefined;
    const controller = new AbortController();
    onToken("");
    setIssue(false);
    setLoading(true);
    void (async () => {
      const response = await fetch("/api/reviews", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("UNAVAILABLE");
      const { siteKey } = await response.json();
      if (typeof siteKey !== "string" || !siteKey)
        throw new Error("UNAVAILABLE");
      const turnstile = await loadScript();
      if (!active || !container.current) return;
      widget = turnstile.render(container.current, {
        sitekey: siteKey,
        action: "submit_review",
        theme: "light",
        language: locale,
        size: compact ? "compact" : "flexible",
        "response-field": false,
        callback: (token: string) => {
          if (active) {
            onToken(token);
            setLoading(false);
            setIssue(false);
          }
        },
        "expired-callback": () => {
          if (active) onToken("");
        },
        "error-callback": () => {
          if (active) {
            onToken("");
            setIssue(true);
            setLoading(false);
          }
        },
        "timeout-callback": () => {
          if (active) {
            onToken("");
            setIssue(true);
            setLoading(false);
          }
        },
      });
      setLoading(false);
    })().catch(() => {
      if (active) {
        setIssue(true);
        setLoading(false);
      }
    });
    return () => {
      active = false;
      controller.abort();
      if (widget !== undefined) window.turnstile?.remove(widget);
    };
  }, [locale, reset, retry, onToken, compact]);
  return (
    <div className="review-captcha">
      <div ref={container} />
      {loading && <p role="status">{reviewCopy.captchaLoading[locale]}</p>}
      {issue && (
        <div role="alert">
          <p>{reviewCopy.captchaUnavailable[locale]}</p>
          <button type="button" onClick={() => setRetry((n) => n + 1)}>
            {reviewCopy.retry[locale]}
          </button>
        </div>
      )}
    </div>
  );
}
