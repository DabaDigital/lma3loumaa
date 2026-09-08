import React from "react";
import ReactDOM from "react-dom/client";
import "./i18n";
import App from "./App";
import "./styles.css";
import { ContentProvider } from "./content";
import { lazy, Suspense } from "react";
const Admin = lazy(() => import("./admin/Admin"));
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ContentProvider>
      <Suspense fallback={<p role="status">Loading…</p>}>
        {/^\/admin(?:\/|$)/.test(window.location.pathname) ? (
          <Admin />
        ) : (
          <App />
        )}
      </Suspense>
    </ContentProvider>
  </React.StrictMode>,
);
