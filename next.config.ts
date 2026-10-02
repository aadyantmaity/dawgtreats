import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

// Only wraps anything when a DSN exists; without one the build is untouched.
export default process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      silent: true,
    })
  : nextConfig;
