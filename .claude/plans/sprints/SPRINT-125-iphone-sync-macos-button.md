# SPRINT-125: iPhone Sync macOS Button Fix

**Created:** 2026-03-11
**Status:** Testing
**Goal:** Fix iPhone sync button not appearing on macOS when Import Source is set to iPhone Sync

---

## Sprint Narrative

A macOS user who sets their Import Source preference to "iPhone Sync" in Settings sees no sync button on the Dashboard. The condition in `AppRouter.tsx` only checks for Windows + iPhone phone type. This sprint adds macOS + iphone-sync import source to the condition.

---

## In-Scope

| Task | Backlog | Title | Est. Tokens | Actual Tokens | Status |
|------|---------|-------|-------------|---------------|--------|
| TASK-2152 | BACKLOG-928 | iPhone sync button hidden on macOS when import source set to iPhone Sync | ~15K | - | Testing |

**Note:** Originally tracked as BACKLOG-924, which was a duplicate ID (also used for Plan Admin UI). Renumbered to BACKLOG-928.

---

## Execution Plan

**Sequential / Single Task** -- no parallel execution needed.

| Order | Task | Branch | Depends On |
|-------|------|--------|------------|
| 1 | TASK-2152 | `feature/task-2152-iphone-sync-macos-visibility` | None |

**PR:** #1121

---

## QA Status (2026-03-11)

QA passed 3/3 tests. Additional improvements discovered during QA are in `stash@{0}`:
- Live update of import source setting (callback chain)
- Dashboard cards refactored to use DashboardActionCard component
- iPhone sync button renamed

**Next steps:** Pop stash, commit fixes, push, request SR review, merge.

**Independent of feature gate work** -- can proceed immediately.

---

## Issues Summary

_To be populated after task completion._

---

## Sprint Retrospective

_To be populated after all tasks complete._
