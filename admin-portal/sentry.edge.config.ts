import * as Sentry from '@sentry/nextjs';

/**
 * Sentry edge-runtime SDK initialization for admin-portal.
 *
 * Runs in the Vercel Edge Runtime (middleware, edge API routes).
 * Kept minimal — no Replay, no heavy integrations.
 */

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: 0.1,
});
