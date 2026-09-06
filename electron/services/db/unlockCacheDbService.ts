/**
 * Unlock Cache Database Service (BACKLOG-2006a)
 *
 * A LOCAL mirror of confirmed server `transaction_unlocks` rows, used ONLY to
 * permit reading an ALREADY-purchased transaction while offline.
 *
 * SECURITY INVARIANT — THE CACHE IS A MIRROR, NEVER A GRANTOR:
 *   - `upsertUnlock` is called ONLY by entitlementService AFTER a live server
 *     read confirms a non-refunded unlock. Nothing else writes here.
 *   - A cache MISS (or empty cache) resolves LOCKED. Absence NEVER implies
 *     unlocked. The read helper below RESOLVES TO a row or null; the caller
 *     awaits it and treats null as locked.
 *   - Rows are keyed by (local_transaction_id, user_id) so a shared device
 *     never leaks one account's unlock to another.
 *
 * The table is created by databaseService migration v50.
 *
 * ===========================================================================
 * BACKLOG-2960 — WHY THESE EXPORTS RETURN PROMISES
 * ===========================================================================
 * Epic 9 moves the async boundary to the export surface of
 * `electron/services/db/**`, so a future non-`better-sqlite3` driver can be
 * swapped in behind it without touching a caller. Until then the work is still
 * synchronous: each wrapper below is a PLAIN function — never `async` — that
 * runs its driver call FIRST and only then wraps the finished value in
 * `Promise.resolve`. That eagerness is the whole design, and it is load-bearing:
 * SR measured on the real driver (PR #2544 review, `4161d899` §2; reproduced in
 * PR #2545, `a5515a44` §5.3) that a plain wrapper's throw propagates
 * synchronously and an enclosing `better-sqlite3` transaction rolls back, while
 * the SAME call through an `async` wrapper lets the transaction COMMIT over the
 * error. Do not add `async` to any export in this file.
 *
 * ===========================================================================
 * THE FAILURE MODE, STATED AS MEASURED — AND IT IS A PAYWALL BYPASS
 * ===========================================================================
 * `entitlementService.getUnlockStatus` decides the per-transaction gate with
 *
 *     const cached = await getCachedUnlock(localTransactionId, userId);
 *     if (cached) return { status: "unlocked", fromCache: true };
 *
 * Drop that `await` and `cached` is a `Promise`, which is ALWAYS truthy — so a
 * cache MISS resolves UNLOCKED, the exact inverse of the fail-closed contract
 * above. Nothing throws and nothing logs.
 *
 * Three independent instruments catch that, all three MEASURED on this PR's own
 * tree by dropping the `await` at `entitlementService.ts:200` and re-running:
 *   - `tsc` — `error TS2801: This condition will always return true since this
 *     'Promise<CachedUnlock | null>' is always defined.` Reported by BOTH
 *     `npm run type-check` and `npm run type-check:tests`.
 *   - `@typescript-eslint/no-misused-promises`, which is enabled for all of
 *     `electron/**`: `Expected non-Promise value in a boolean conditional`.
 *     This one fires under the PROJECT config, i.e. under CI's `npm run lint`.
 *   - `electron/services/db/__tests__/unlockCacheDbService.realDriver-2960.test.ts`,
 *     RED by name on `OFFLINE + empty cache ⇒ LOCKED (offline_uncached)` and on
 *     `ONLINE + the server read FAILS + empty cache ⇒ LOCKED (error)`.
 *
 * The two `void`-returning writes below (`upsertUnlock`, `removeCachedUnlock`)
 * are the weaker case, and it is worth being exact about why. A plain wrapper
 * has already done the work by the time the promise exists, so dropping their
 * `await` changes nothing observable on this driver: measured, `tsc` is silent,
 * the project eslint config is silent, and the real-driver suite above stays
 * 16/16 green. What does see it: the forced `no-floating-promises` rule (12 -> 13
 * on `entitlementService.ts`, which is NOT in that rule's `files:` scope, so it
 * is not a CI gate — BACKLOG-3150), and the two `BACKLOG-2960 — ... BEFORE
 * getUnlockStatus returns` cases in `entitlementService.test.ts`, whose mock
 * settles on a macrotask precisely so that a dropped `await` on a write is
 * visible. Both were measured RED under exactly that mutation.
 */

import { dbGet, dbRun } from "./core/dbConnection";
import { sql } from "./core/sqlText";
import logService from "../logService";

/** A cached mirror of a confirmed server unlock. */
export interface CachedUnlock {
  local_transaction_id: string;
  user_id: string;
  unlocked_at: string;
  funding_source: string | null;
  cached_at: string;
}

/**
 * Look up a cached unlock for a specific (transaction, user).
 *
 * @returns a promise resolving to the cached row, or to null if none exists
 *          (⇒ the caller treats null as LOCKED). MUST be awaited: the resolved
 *          null is the LOCKED signal, and the unawaited promise is truthy.
 *
 * @example
 *   const cached = await getCachedUnlock(localTransactionId, userId);
 *   if (cached) { ... }
 */
export function getCachedUnlock(
  localTransactionId: string,
  userId: string,
): Promise<CachedUnlock | null> {
  const row = dbGet<CachedUnlock>(
    sql`SELECT local_transaction_id, user_id, unlocked_at, funding_source, cached_at
       FROM transaction_unlocks_cache
      WHERE local_transaction_id = ? AND user_id = ?`,
    [localTransactionId, userId],
  );
  return Promise.resolve(row ?? null);
}

/**
 * Write/refresh a cache mirror of a CONFIRMED server unlock.
 *
 * MUST only be called after a live server read has confirmed a non-refunded
 * `transaction_unlocks` row for this (transaction, user). Passing an unverified
 * value here would violate the cache-is-a-mirror invariant.
 *
 * @example
 *   await upsertUnlock({ localTransactionId, userId, unlockedAt, fundingSource });
 */
export function upsertUnlock(params: {
  localTransactionId: string;
  userId: string;
  unlockedAt: string;
  fundingSource?: string | null;
}): Promise<void> {
  dbRun(
    sql`INSERT INTO transaction_unlocks_cache
       (local_transaction_id, user_id, unlocked_at, funding_source, cached_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(local_transaction_id, user_id) DO UPDATE SET
       unlocked_at = excluded.unlocked_at,
       funding_source = excluded.funding_source,
       cached_at = datetime('now')`,
    [
      params.localTransactionId,
      params.userId,
      params.unlockedAt,
      params.fundingSource ?? null,
    ],
  );
  return Promise.resolve();
}

/**
 * Remove a cache mirror. Called when a live server read shows the unlock is
 * GONE or REFUNDED — so the offline view re-locks, matching server truth.
 *
 * @example
 *   await removeCachedUnlock(localTransactionId, userId);
 */
export function removeCachedUnlock(
  localTransactionId: string,
  userId: string,
): Promise<void> {
  dbRun(
    sql`DELETE FROM transaction_unlocks_cache
      WHERE local_transaction_id = ? AND user_id = ?`,
    [localTransactionId, userId],
  );
  return Promise.resolve();
}

/**
 * Clear all cached unlocks (call on logout, mirroring feature-gate cache clear).
 *
 * @example
 *   await clearUnlockCache();
 */
export function clearUnlockCache(): Promise<void> {
  dbRun(sql`DELETE FROM transaction_unlocks_cache`, []);
  void logService.info(
    "[UnlockCache] Cleared all cached unlocks",
    "UnlockCacheDbService",
  );
  return Promise.resolve();
}
