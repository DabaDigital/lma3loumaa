import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";

export function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`skeleton ${className}`} aria-hidden="true" />;
}

function Loading({ children, kind }: { children: ReactNode; kind: string }) {
  const { i18n } = useTranslation();
  const label =
    i18n.resolvedLanguage === "ar"
      ? "جارٍ التحميل…"
      : i18n.resolvedLanguage === "en"
        ? "Loading…"
        : "Chargement…";
  return (
    <div
      className={`skeleton-layout skeleton-${kind}`}
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

function Lines() {
  return (
    <div className="skeleton-lines">
      <Skeleton className="skeleton-title" />
      <Skeleton />
      <Skeleton className="skeleton-short" />
    </div>
  );
}

export function ContentSkeleton({
  kind = "menu",
}: {
  kind?:
    | "menu"
    | "locations"
    | "reviews"
    | "admin-reviews"
    | "table"
    | "overview"
    | "login"
    | "banner";
}) {
  if (kind === "login")
    return (
      <Loading kind={kind}>
        <Skeleton className="skeleton-field" />
        <Skeleton className="skeleton-field" />
        <Skeleton className="skeleton-field" />
      </Loading>
    );
  if (kind === "banner")
    return (
      <Loading kind={kind}>
        <Skeleton className="skeleton-picture" />
        <Lines />
      </Loading>
    );
  if (kind === "table" || kind === "overview")
    return (
      <Loading kind={kind}>
        {kind === "overview" && (
          <div className="skeleton-stats">
            {[0, 1, 2].map((n) => (
              <div className="skeleton-card" key={n}>
                <Lines />
                <Skeleton className="skeleton-number" />
              </div>
            ))}
          </div>
        )}
        <div className="skeleton-table">
          <Skeleton className="skeleton-field" />
          {[0, 1, 2, 3, 4].map((n) => (
            <div className="skeleton-row" key={n}>
              <Skeleton className="skeleton-thumb" />
              <Lines />
              <Skeleton className="skeleton-pill" />
            </div>
          ))}
        </div>
      </Loading>
    );
  const count =
    kind === "menu" ? 8 : kind === "locations" ? 2 : kind === "reviews" ? 3 : 4;
  return (
    <Loading kind={kind}>
      {kind === "menu" && (
        <>
          <Skeleton className="skeleton-field" />
          <div className="skeleton-tabs">
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <Skeleton className="skeleton-pill" key={n} />
            ))}
          </div>
        </>
      )}
      <div className="skeleton-grid">
        {Array.from({ length: count }, (_, n) => (
          <div className="skeleton-card" key={n}>
            {(kind === "menu" || kind === "locations") && (
              <Skeleton className="skeleton-picture" />
            )}
            <div className="skeleton-card-body">
              {(kind === "reviews" || kind === "admin-reviews") && (
                <Skeleton className="skeleton-pill" />
              )}
              <Lines />
              <div className="skeleton-card-bottom">
                <Skeleton className="skeleton-pill" />
                <Skeleton
                  className={
                    kind === "menu" ? "skeleton-circle" : "skeleton-pill"
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Loading>
  );
}

// This fallback lives outside the lazy admin bundle, so it works before its CSS arrives.
export function PageSkeleton() {
  return (
    <div className="skeleton-page">
      <div className="skeleton-page-sidebar" aria-hidden="true">
        <Skeleton className="skeleton-field" />
        {[0, 1, 2, 3, 4].map((n) => (
          <Skeleton className="skeleton-field" key={n} />
        ))}
      </div>
      <main>
        <div className="skeleton-page-header" aria-hidden="true">
          <Skeleton className="skeleton-title" />
        </div>
        <ContentSkeleton kind="overview" />
      </main>
    </div>
  );
}
