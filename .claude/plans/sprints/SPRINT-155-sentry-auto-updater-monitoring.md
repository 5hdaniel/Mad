# SPRINT-155: Sentry Auto-Updater Monitoring

**Status:** Active
**Sprint UUID:** c0320d1f-268e-4497-b6f4-329d794d4415
**Created:** 2026-03-30
**Integration Branch:** int/sprint-155-sentry-updater
**Goal:** Add comprehensive Sentry monitoring to the auto-update lifecycle to catch update failures (like v2.15.0/v2.15.2 filename mismatch) early.

---

## In-Scope

| Task | Title | Status | Est Tokens | Actual Tokens |
|------|-------|--------|------------|---------------|
| TASK-2330 | Add Sentry monitoring for auto-update lifecycle | In Progress | ~30K | — |

---

## Dependency Graph

Single task sprint — no dependencies.

**Execution:** Sequential (single task)

---

## Notes

- BACKLOG-1554 already reviewed and approved by PM and SR Engineer
- `Sentry.setUser()` on session restore already exists (sessionHandlers.ts:995) — no changes needed there
- SR Engineer recommendations incorporated into task file
- Single task sprint, straightforward implementation

---

## Sprint Retrospective

_To be completed after sprint._
