import * as Sentry from '@sentry/nextjs'

// No DSN (local dev, tests, a fork) means Sentry stays off rather than erroring.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  tracesSampleRate: 0,
})
