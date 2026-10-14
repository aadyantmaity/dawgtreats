import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
// React uses eval in development to rebuild stack traces. It never does in production.
const dev = process.env.NODE_ENV === "development";

// Nonces would be stricter, but Next can only inject them into dynamically rendered
// pages, and the menu, lookup and 404 pages are static. See docs/SECURITY.md.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' ${supabase}`.trim(),
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  // Chrome exempts localhost and 127.0.0.1 from the upgrade, but not 0.0.0.0, where it
  // asks for every script and stylesheet over https and the dev server answers 503.
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  images: {
    // Without this the optimiser serves max-age=0, so every visitor re-downloads every
    // photo. The files only change on a deploy, and a new photo needs a new filename.
    minimumCacheTTL: 2678400,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

// Only wraps anything when a DSN exists; without one the build is untouched.
export default process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      silent: true,
    })
  : nextConfig;
