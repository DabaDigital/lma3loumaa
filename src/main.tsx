import React from "react";
import ReactDOM from "react-dom/client";
import "./i18n";
import App from "./App";
import "./styles.css";
import "./reviews.css";
import "./skeleton.css";
import { PageSkeleton } from "./Skeleton";
import { ContentProvider } from "./content";
import { lazy, Suspense } from "react";
const Admin = lazy(() => import("./admin/Admin"));
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ContentProvider>
      <Suspense fallback={<PageSkeleton />}>
        {/^\/admin(?:\/|$)/.test(window.location.pathname) ? (
          <Admin />
        ) : (
          <App />
        )}
      </Suspense>
    </ContentProvider>
  </React.StrictMode>,
);
