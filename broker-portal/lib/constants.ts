/**
 * Shared constants for the broker portal.
 *
 * This file is safe to import from Edge Runtime (middleware)
 * because it has no heavy dependencies.
 */

/**
 * Cookie name for impersonation sessions.
 * Canonical value -- keep in sync with lib/impersonation.ts.
 */
export const IMPERSONATION_COOKIE_NAME = 'impersonation_session';
