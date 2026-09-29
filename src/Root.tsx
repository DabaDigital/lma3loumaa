import { lazy, StrictMode, Suspense } from "react";
import "./i18n";
import App from "./App";
import { PageSkeleton } from "./Skeleton";
import { ContentProvider } from "./content";

const Admin = lazy(() => import("./admin/Admin"));

/** The whole page, shared by the browser entry and the build-time prerender. */
export function Root({ admin }: { admin: boolean }) {
  return (
    <StrictMode>
      <ContentProvider>
        <Suspense fallback={<PageSkeleton />}>
          {admin ? <Admin /> : <App />}
        </Suspense>
      </ContentProvider>
    </StrictMode>
  );
}
