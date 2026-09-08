import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createReviewHandler } from "./api/reviews.js";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    {
      name: "local-review-api",
      configureServer(server) {
        const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
        const handler = createReviewHandler({
          env: {
            ...env,
            VERCEL: "1",
            VERCEL_ENV: "development",
            REVIEW_ALLOWED_HOSTNAMES: "localhost,127.0.0.1,[::1]",
          },
        });
        server.middlewares.use("/api/reviews", async (req, res) => {
          try {
            const chunks: Buffer[] = [];
            let size = 0;
            for await (const chunk of req) {
              size += chunk.length;
              if (size > 12000) {
                res.statusCode = 413;
                res.end();
                return;
              }
              chunks.push(chunk);
            }
            const headers = new Headers();
            for (const [name, value] of Object.entries(req.headers))
              if (value)
                headers.set(
                  name,
                  Array.isArray(value) ? value.join(",") : value,
                );
            // Local tests use the actual TCP peer, ignoring any supplied IP headers.
            headers.set(
              "x-vercel-forwarded-for",
              req.socket.remoteAddress || "127.0.0.1",
            );
            const request = new Request(
              `http://${req.headers.host}/api/reviews`,
              {
                method: req.method,
                headers,
                ...(req.method === "POST"
                  ? { body: Buffer.concat(chunks).toString() }
                  : {}),
              },
            );
            const response = await handler(request);
            res.statusCode = response.status;
            response.headers.forEach((value, name) =>
              res.setHeader(name, value),
            );
            res.end(await response.text());
          } catch {
            res.statusCode = 503;
            res.end(JSON.stringify({ error: "UNAVAILABLE" }));
          }
        });
      },
    },
  ],
}));
