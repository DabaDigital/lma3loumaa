import { createClient } from "@supabase/supabase-js";
import { createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { reviewConfig } from "../server/review-config.js";

const UUID =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const types = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const json = (body, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const failure = (code, status) => json({ error: code }, status);

export function createReviewHandler({
  env = process.env,
  fetcher = fetch,
  clientFactory = createClient,
  logConfigurationError = (issues) =>
    console.error("Reviews configuration:", issues.join("; ")),
} = {}) {
  let lastConfigError = "";
  return async function handle(request) {
    if (!["GET", "POST"].includes(request.method))
      return failure("METHOD_NOT_ALLOWED", 405);
    const { settings, issues } = reviewConfig(env);
    if (!settings) {
      const diagnostic = issues.join("; ");
      if (diagnostic !== lastConfigError) {
        lastConfigError = diagnostic;
        logConfigurationError(issues);
      }
      return failure("UNAVAILABLE", 503);
    }
    lastConfigError = "";
    if (request.method === "GET") return json({ siteKey: settings.siteKey });
    // This route must be deployed directly on Vercel. Never trust a client JSON
    // field or a generic proxy chain as the visitor identity.
    const ip = request.headers.get("x-vercel-forwarded-for")?.trim();
    if (!ip || !isIP(ip) || env.VERCEL !== "1")
      return failure("UNAVAILABLE", 503);
    const hostname = new URL(request.url).hostname.toLowerCase();
    const origin = request.headers.get("origin");
    if (
      !settings.hosts.includes(hostname) ||
      !origin ||
      origin !== new URL(request.url).origin
    )
      return failure("INVALID_ORIGIN", 403);
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return failure("INVALID_INPUT", 400);
    try {
      // JSON contains only text and upload metadata, never the image itself.
      const text = await request.text();
      if (text.length > 12000) return failure("INVALID_INPUT", 413);
      const body = JSON.parse(text);
      if (
        !body ||
        typeof body !== "object" ||
        !UUID.test(body.id ?? "") ||
        !["prepare", "complete"].includes(body.action)
      )
        return failure("INVALID_INPUT", 400);
      const source = createHmac(
        "sha256",
        env.REVIEW_RATE_LIMIT_SECRET || settings.secret,
      )
        .update(ip)
        .digest("hex");
      const db = clientFactory(settings.url, settings.key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const call = async (name, args) => {
        const result = await db.rpc(name, args);
        if (result.error) throw result.error;
        return result.data;
      };
      if (body.action === "prepare") {
        const {
          title,
          description = "",
          rating,
          imageType = null,
          imageSize = 0,
          captchaToken,
        } = body;
        if (
          typeof title !== "string" ||
          !title.trim() ||
          [...title.trim()].length > 100 ||
          typeof description !== "string" ||
          [...description.trim()].length > 1500 ||
          !Number.isInteger(rating) ||
          rating < 1 ||
          rating > 5 ||
          (imageType !== null &&
            (!Object.hasOwn(types, imageType) ||
              !Number.isInteger(imageSize) ||
              imageSize < 1 ||
              imageSize > 5242880))
        )
          return failure("INVALID_INPUT", 400);
        if (
          typeof captchaToken !== "string" ||
          !captchaToken ||
          captchaToken.length > 2048
        )
          return failure("CAPTCHA_FAILED", 400);
        const verification = await fetcher(
          "https://challenges.cloudflare.com/turnstile/v0/siteverify",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              secret: settings.secret,
              response: captchaToken,
              remoteip: ip,
              idempotency_key: randomUUID(),
            }),
            signal: AbortSignal.timeout(10000),
          },
        );
        if (!verification.ok) return failure("CAPTCHA_FAILED", 400);
        const verdict = await verification.json();
        if (
          verdict.success !== true ||
          verdict.hostname !== hostname ||
          verdict.action !== "submit_review"
        )
          return failure("CAPTCHA_FAILED", 400);
        const path = imageType ? `${body.id}/photo.${types[imageType]}` : null;
        const reserved = await call("prepare_guest_review", {
          p_id: body.id,
          p_source: source,
          p_title: title.trim(),
          p_description: description.trim(),
          p_rating: rating,
          p_image_path: path,
        });
        if (reserved.completed || !path) return json(reserved);
        // Successful retries may already have a file. Never overwrite it.
        const staged = await db.storage.from("review-uploads").info(path);
        const moved = staged.error
          ? await db.storage.from("review-images").info(path)
          : null;
        if (!staged.error || (moved && !moved.error))
          return json({ ...reserved, uploaded: true });
        const { data, error } = await db.storage
          .from("review-uploads")
          .createSignedUploadUrl(path, { upsert: false });
        if (error) throw error;
        return json({ ...reserved, upload: { path, token: data.token } });
      }
      const submission = await call("get_guest_review_submission", {
        p_id: body.id,
        p_source: source,
      });
      if (submission.completed) return json(submission);
      if (submission.image_path) {
        const path = submission.image_path;
        const existing = await db.storage.from("review-images").info(path);
        if (existing.error) {
          const moved = await db.storage
            .from("review-uploads")
            .move(path, path, { destinationBucket: "review-images" });
          if (moved.error) {
            // A parallel retry may have moved the same immutable object already.
            const retry = await db.storage.from("review-images").info(path);
            if (retry.error) return failure("PHOTO_MISSING", 400);
          }
        }
      }
      return json(
        await call("complete_guest_review", {
          p_id: body.id,
          p_source: source,
        }),
      );
    } catch (error) {
      const message = error?.message || "";
      if (message.includes("REVIEW_DAILY_LIMIT"))
        return failure("DAILY_LIMIT", 429);
      if (message.includes("REVIEW_EXPIRED")) return failure("EXPIRED", 409);
      if (message.includes("REVIEW_CONFLICT")) return failure("CONFLICT", 409);
      if (message.includes("REVIEW_PHOTO_MISSING"))
        return failure("PHOTO_MISSING", 400);
      if (error instanceof SyntaxError || error?.code === "23514")
        return failure("INVALID_INPUT", 400);
      // Never return database details, credentials, IPs or CAPTCHA tokens.
      return failure("UNAVAILABLE", 503);
    }
  };
}

export default { fetch: createReviewHandler() };
