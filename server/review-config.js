// Shared by the API and the deployment check. Diagnostics name settings only;
// credentials must never appear in responses, logs, or command output.
export function reviewConfig(env) {
  const value = (name) =>
    typeof env[name] === "string" ? env[name].trim() : "";
  const key =
    value("SUPABASE_SECRET_KEY") || value("SUPABASE_SERVICE_ROLE_KEY");
  const url = value("SUPABASE_URL") || value("VITE_SUPABASE_URL");
  const siteKey = value("TURNSTILE_SITE_KEY");
  const secret = value("TURNSTILE_SECRET_KEY");
  const hosts = value("REVIEW_ALLOWED_HOSTNAMES")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  const issues = [];
  if (!key)
    issues.push("Set SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)");
  if (!url) issues.push("Set SUPABASE_URL (or VITE_SUPABASE_URL)");
  else {
    try {
      const parsed = new URL(url);
      if (!["https:", "http:"].includes(parsed.protocol)) throw new Error();
    } catch {
      issues.push("SUPABASE_URL must be an HTTP(S) URL");
    }
  }
  if (key.startsWith("sb_publishable_"))
    issues.push(
      "SUPABASE_SECRET_KEY must be a server key, not a publishable key",
    );
  if (!siteKey) issues.push("Set TURNSTILE_SITE_KEY");
  if (!secret) issues.push("Set TURNSTILE_SECRET_KEY");
  if (!hosts.length) issues.push("Set REVIEW_ALLOWED_HOSTNAMES");
  else if (
    hosts.some((host) => {
      try {
        return (
          new URL(`https://${host}`).hostname !== host || /[/?#@]/.test(host)
        );
      } catch {
        return true;
      }
    })
  )
    issues.push(
      "REVIEW_ALLOWED_HOSTNAMES must contain hostnames only, without URLs or paths",
    );
  if (
    env.VERCEL_ENV === "production" &&
    (/^[123]x0+/.test(siteKey) || /^[123]x0+/.test(secret))
  )
    issues.push("Replace Turnstile test keys with production widget keys");
  return {
    issues,
    settings: issues.length ? null : { key, url, siteKey, secret, hosts },
  };
}
