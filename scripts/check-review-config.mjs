import { loadEnv } from "vite";
import { reviewConfig } from "../server/review-config.js";

// Local .env files are useful for development. A deployed check must inspect
// the deployment environment only, so a local file cannot hide a missing key.
const env = process.env.VERCEL
  ? process.env
  : { ...loadEnv("production", process.cwd(), ""), ...process.env };
const { issues } = reviewConfig({ ...env, VERCEL_ENV: "production" });
if (issues.length) {
  console.error("Review API configuration is incomplete:");
  for (const issue of issues) console.error(`- ${issue}`);
  console.error(
    "See docs/review-protection.md. Credential values are never printed.",
  );
  process.exitCode = 1;
} else {
  console.log(
    "PASS: review API settings are present and structurally valid. Verify the live widget and database setup before activation.",
  );
}
