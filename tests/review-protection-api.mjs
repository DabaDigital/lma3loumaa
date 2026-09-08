import assert from "node:assert/strict";
import { createReviewHandler } from "../api/reviews.js";
const id = "10000000-0000-4000-8000-000000000001";
const env = {
  VERCEL: "1",
  VERCEL_ENV: "production",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "server-only-key",
  TURNSTILE_SITE_KEY: "real-site-key",
  TURNSTILE_SECRET_KEY: "server-only-captcha",
  REVIEW_ALLOWED_HOSTNAMES: "example.com",
};
let verdict = {
  success: true,
  hostname: "example.com",
  action: "submit_review",
};
let rpcError = null,
  rpcCalls = [],
  uploads = [],
  moves = [],
  verified = [],
  complete = false,
  hasFinal = false,
  preparedPath = null;
const client = {
  rpc: async (name, args) => {
    rpcCalls.push({ name, args });
    if (name === "prepare_guest_review" && !rpcError)
      preparedPath = args.p_image_path;
    return {
      error: rpcError,
      data: {
        id,
        completed: complete || name === "complete_guest_review",
        image_path: preparedPath,
      },
    };
  },
  storage: {
    from: (bucket) => ({
      info: async () => ({
        error:
          bucket === "review-images" && hasFinal
            ? null
            : { message: "Not found" },
      }),
      createSignedUploadUrl: async (path, options) => {
        uploads.push({ bucket, path, options });
        return { data: { token: "signed-upload" }, error: null };
      },
      move: async (from, to, options) => {
        moves.push({ from, to, options });
        return { error: null };
      },
    }),
  },
};
const handler = createReviewHandler({
  env,
  clientFactory: () => client,
  fetcher: async (_url, options) => {
    verified.push(JSON.parse(options.body));
    return Response.json(verdict);
  },
});
function request(body, headers = {}) {
  return new Request("https://example.com/api/reviews", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://example.com",
      "x-vercel-forwarded-for": "203.0.113.1",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
const payload = {
  action: "prepare",
  id,
  title: "A",
  description: "",
  rating: 5,
  captchaToken: "captcha-token",
};
assert.equal(
  (await handler(new Request("https://example.com/api/reviews"))).status,
  200,
);
assert.equal(
  (await handler(request({ ...payload, captchaToken: "" }))).status,
  400,
);
assert.equal(rpcCalls.length, 0);
for (const bad of [
  { success: false },
  { ...verdict, hostname: "evil.example" },
  { ...verdict, action: "login" },
]) {
  const old = verdict;
  verdict = bad;
  assert.equal((await handler(request(payload))).status, 400);
  verdict = old;
}
assert.equal(rpcCalls.length, 0, "invalid CAPTCHAs never reserve a slot");
assert.equal(
  (await handler(request(payload, { "x-vercel-forwarded-for": "" }))).status,
  503,
);
assert.equal(
  (
    await handler(
      request(payload, { "x-vercel-forwarded-for": "1.2.3.4, 2.3.4.5" }),
    )
  ).status,
  503,
);
assert.equal(
  (await handler(request(payload, { Origin: "https://evil.example" }))).status,
  403,
);
assert.equal((await handler(request("{"))).status, 400);
for (const invalid of [
  { title: " " },
  { rating: 0 },
  { rating: 6 },
  { description: "x".repeat(1501) },
  { imageType: "image/svg+xml", imageSize: 1 },
  { imageType: "image/png", imageSize: 5242881 },
]) {
  assert.equal(
    (await handler(request({ ...payload, ...invalid }))).status,
    400,
  );
}
assert.equal((await handler(request(payload))).status, 200);
assert.equal(rpcCalls.at(-1).args.p_description, "");
assert.match(rpcCalls.at(-1).args.p_source, /^[a-f0-9]{64}$/);
assert.notEqual(rpcCalls.at(-1).args.p_source, "203.0.113.1");
assert.equal(verified.at(-1).remoteip, "203.0.113.1");
const originalSource = rpcCalls.at(-1).args.p_source;
await handler(
  request(
    { ...payload, source: "fake", day: "2099-01-01" },
    { "x-forwarded-for": "198.51.100.20" },
  ),
);
assert.equal(
  rpcCalls.at(-1).args.p_source,
  originalSource,
  "spoofable headers and fields do not change identity",
);
assert.equal(
  (
    await handler(
      request({ ...payload, imageType: "image/png", imageSize: 100 }),
    )
  ).status,
  200,
);
assert.deepEqual(uploads.at(-1), {
  bucket: "review-uploads",
  path: `${id}/photo.png`,
  options: { upsert: false },
});
rpcError = { message: "REVIEW_DAILY_LIMIT" };
const limited = await handler(request(payload));
assert.equal(limited.status, 429);
assert.deepEqual(await limited.json(), { error: "DAILY_LIMIT" });
rpcError = null;
const before = verified.length;
assert.equal((await handler(request({ action: "complete", id }))).status, 200);
assert.equal(
  verified.length,
  before,
  "completion uses the previously verified reservation",
);
assert.equal(moves.length, 1);
assert.equal(moves[0].options.destinationBucket, "review-images");
complete = true;
assert.equal((await handler(request({ action: "complete", id }))).status, 200);
assert.equal(
  moves.length,
  1,
  "an idempotent retry does not move or replace a photo",
);
complete = false;
for (const code of ["REVIEW_EXPIRED", "REVIEW_CONFLICT"]) {
  rpcError = { message: code };
  assert.equal(
    (await handler(request({ action: "complete", id }))).status,
    409,
  );
}
rpcError = { message: "sensitive database detail" };
assert.deepEqual(await (await handler(request(payload))).json(), {
  error: "UNAVAILABLE",
});
for (const settings of [
  {},
  { ...env, TURNSTILE_SITE_KEY: "1x00000000000000000000AA" },
]) {
  const disabled = createReviewHandler({ env: settings });
  assert.equal(
    (await disabled(new Request("https://example.com/api/reviews"))).status,
    503,
  );
}
console.log(
  "PASS: server CAPTCHA validation, hostname/action checks, trusted IP identity, validation, staging uploads, quota errors, retries, and fail-closed configuration.",
);
