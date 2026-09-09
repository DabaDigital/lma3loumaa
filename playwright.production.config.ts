import { defineConfig } from "@playwright/test";
import adminConfig from "./playwright.admin.config";

// Exercise the emitted chunks with the existing mocked backend, not live data.
export default defineConfig(adminConfig, {
  outputDir: "./artifacts/performance/production-test-results",
  use: { baseURL: "http://127.0.0.1:5176" },
  webServer: {
    command:
      "npm run build -- --outDir artifacts/performance/production-dist && npm run preview -- --outDir artifacts/performance/production-dist --port 5176 --strictPort",
    url: "http://127.0.0.1:5176",
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: "https://test-project.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_only",
    },
  },
});
