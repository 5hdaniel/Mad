-- Migration: BACKLOG-1656 — Backfill pm_backlog_items.legacy_id and pm_token_metrics.backlog_item_id
--
-- Context: Many pm_backlog_items rows had legacy_id = NULL, and many pm_token_metrics rows
-- had backlog_item_id = NULL while their task_id column held the legacy-style text id
-- (e.g. "BACKLOG-1585"). This broke the per-task effort bar on admin portal task detail pages
-- (BACKLOG-1644 UI) because getTaskMetrics() relies on one of the legacy_id chains.
--
-- This migration is IDEMPOTENT — safe to run multiple times or on environments that were
-- already backfilled. It only touches rows where the target column is still NULL or the
-- legacy_id mismatches its own item_number.
--
-- Stages (all applied to production on 2026-04-17/21):
--   A. Backfill pm_token_metrics.backlog_item_id via task_id → legacy_id match
--   B. Backfill pm_backlog_items.legacy_id = 'BACKLOG-' || item_number for non-colliding rows
--   C. Reclaim 2 soft-deleted collisions + rename 21 incorrect legacy_ids on active rows +
--      rename 2 pending email-sync-pill rows (items 1497/1498) to their own item_numbers

BEGIN;

-- ============================================================================
-- Stage A: Backfill pm_token_metrics.backlog_item_id from task_id → legacy_id
-- ============================================================================
UPDATE pm_token_metrics tm
SET backlog_item_id = bi.id
FROM pm_backlog_items bi
WHERE tm.backlog_item_id IS NULL
  AND tm.task_id = bi.legacy_id
  AND bi.deleted_at IS NULL;

-- ============================================================================
-- Stage C.1: Reclaim legacy_ids held by soft-deleted rows
-- ============================================================================
-- Two active items (969 "Admin portal auto-provisioning fails", 970 "M365 same-tenant
-- email delivery issue") had NULL legacy_ids because the matching BACKLOG-969/970
-- were held by two soft-deleted "PM Module — X Components" rows. Since those rows
-- are deleted, clearing their legacy_id is safe (nothing references them).
UPDATE pm_backlog_items
SET legacy_id = NULL,
    updated_at = now()
WHERE deleted_at IS NOT NULL
  AND legacy_id IN ('BACKLOG-969', 'BACKLOG-970')
  AND item_number IN (1155, 1156);

-- ============================================================================
-- Stage C.2: Rename 23 incorrect legacy_ids on active rows
-- ============================================================================
-- These rows had legacy_id = 'BACKLOG-<wrong_number>' where <wrong_number> didn't
-- match their own item_number. Someone manually assigned these legacy_ids and
-- made systematic mistakes (e.g. items 1157-1160 were given BACKLOG-971..974).
-- Fix: each affected row gets legacy_id = 'BACKLOG-' || its own item_number.
--
-- The UPDATE uses a WHERE clause that MATCHES THE EXACT KNOWN MISMATCH, so it's
-- safe to replay — if already fixed, the row won't match and nothing happens.
UPDATE pm_backlog_items
SET legacy_id = 'BACKLOG-' || item_number::text,
    updated_at = now()
WHERE deleted_at IS NULL
  AND legacy_id IS NOT NULL
  AND legacy_id != 'BACKLOG-' || item_number::text
  AND legacy_id ~ '^BACKLOG-[0-9]+$'
  AND item_number IN (
    1157, 1158, 1159, 1160,  -- collided with 971-974 (PM Module components)
    1384, 1385, 1386, 1387,  -- collided with 1343-1346 (support ticket fixes)
    1389,                     -- collided with 1347
    1403,                     -- collided with 1348 (token metrics breakdown)
    1406, 1407, 1408, 1409, 1410, 1411, 1412, 1413, 1414,  -- collided with 1349-1357 (security fixes)
    1497, 1498,               -- collided with 1451/1452 (email sync pill)
    1499,                     -- collided with 1453
    1562                      -- collided with 1554 (Sentry auto-updater)
  );

-- ============================================================================
-- Stage B: Backfill pm_backlog_items.legacy_id for all remaining NULL rows
-- ============================================================================
-- Runs AFTER the Stage C renames so previously-blocked rows can now be backfilled.
-- For each active row with NULL legacy_id, assign 'BACKLOG-' || item_number unless
-- that value is already in use (safety net — should be empty after Stages C.1+C.2).
UPDATE pm_backlog_items src
SET legacy_id = 'BACKLOG-' || src.item_number::text,
    updated_at = now()
WHERE src.legacy_id IS NULL
  AND src.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM pm_backlog_items other
    WHERE other.legacy_id = 'BACKLOG-' || src.item_number::text
      AND other.id != src.id
  );

-- ============================================================================
-- Stage A (replay): Now that more legacy_ids exist, re-link any metrics
-- ============================================================================
-- New legacy_ids set by Stages B/C can match pm_token_metrics.task_id entries
-- that didn't match before. Replay the same logic to pick them up.
UPDATE pm_token_metrics tm
SET backlog_item_id = bi.id
FROM pm_backlog_items bi
WHERE tm.backlog_item_id IS NULL
  AND tm.task_id = bi.legacy_id
  AND bi.deleted_at IS NULL;

COMMIT;

-- ============================================================================
-- Expected post-migration state (as of 2026-04-21):
--   pm_backlog_items with legacy_id IS NULL AND deleted_at IS NULL → 0
--   pm_token_metrics with backlog_item_id IS NULL AND task_id LIKE 'BACKLOG-%' → 0
-- ============================================================================
