# SPRINT-096: Sentry + Email Unification

**Created:** 2026-02-22
**Status:** Completed
**Base:** `develop` (after all SPRINT-095 work merged)

---

## Sprint Goal

Add production observability to all sync paths via Sentry instrumentation, fix the 200-email cap that silently drops older emails, and make email attachment export folders human-readable.

## Sprint Narrative

Three distinct workstreams, all improving sync reliability and data completeness:

1. **Sentry instrumentation** (Critical): We currently have zero visibility into sync failures in production. If auto-sync silently fails for a user, we have no error, no reason, nothing. This is the highest priority item -- production observability is a prerequisite for knowing if anything else is broken.

2. **Email 200-cap fix** (High): QA discovered that the hardcoded `maxResults: 200` in email fetching silently drops emails beyond the 200 most recent. For long audit periods (e.g., 2 years), this means missing emails. The fix replaces the cap with date-range filtering based on the transaction's audit period.

3. **Attachment folder names** (Medium): TASK-2050 added per-thread attachment directories, but they use cryptic Outlook IDs instead of matching the human-readable thread PDF naming convention. Quick fix for usability.

---

## In-Scope

| ID | Title | Task | Batch | Est Tokens | Actual Tokens | PR | Merged | Status |
|----|-------|------|-------|-----------|---------------|-----|--------|--------|
| BACKLOG-795 | Sentry instrumentation for all sync paths | TASK-2059 | 1 (parallel) | ~30K | ~30K | #954 | 2026-02-23 | Completed |
| BACKLOG-786 | Email unification Phase 1 -- fix 200-email cap | TASK-2060 | 1 (parallel) | ~65K | ~65K | #955 | 2026-02-23 | Completed |
| BACKLOG-785 | Human-readable attachment folder names | TASK-2061 | 1 (parallel) | ~25K | ~15K | #953 | 2026-02-23 | Completed |

**Total Estimated Tokens:** ~120K (engineering) + ~45K (SR review) = ~165K

---

## Out of Scope

- **Full email unification** (BACKLOG-786 Phase 2) -- Consolidating all 5 email paths into a single service. Phase 1 fixes the cap and extracts a shared helper.
- **Lookback settings consolidation** -- The 4 overlapping lookback settings need cleanup but are separate scope.
- **Auto-link bug fix** -- Auto-link was broken since Jan 26 (BACKLOG-506). Fixed during QA but needs proper PR in a separate item.
- **Thread display issues** -- "Shows only one sender" needs investigation, separate item.
- **Sentry performance tracing** -- Only error capture + breadcrumbs in this sprint.

---

## Execution Plan

### Batch 1 (Parallel): TASK-2059, TASK-2060, TASK-2061

These three tasks touch different areas of the codebase with minimal overlap:

| Task | Primary Files | Overlap Risk |
|------|--------------|--------------|
| TASK-2059 (Sentry) | `SyncOrchestratorService.ts`, `emailSyncHandlers.ts` (additive imports only), `messageImportHandlers.ts`, `useAutoRefresh.ts` | Low -- only adding import + additive calls |
| TASK-2060 (Email cap) | `emailSyncHandlers.ts` (handler logic), `outlookFetchService.ts`, `gmailFetchService.ts` | **Shared file with TASK-2059**: `emailSyncHandlers.ts` |
| TASK-2061 (Attachments) | `attachmentHelpers.ts`, `folderExportService.ts` | None with others |

**Shared file risk:** Both TASK-2059 and TASK-2060 modify `emailSyncHandlers.ts`. However:
- TASK-2059 only adds a Sentry import and `captureException` calls inside existing catch blocks
- TASK-2060 modifies the handler logic (replacing maxResults, extracting helper)
- These changes are in different locations and unlikely to conflict

**SR Engineer should confirm parallel safety during Technical Review.**

If SR determines they must be sequential, run TASK-2059 first (smaller, additive) then TASK-2060.

---

## Dependency Graph

```
TASK-2059 (Sentry)           ──┐
TASK-2060 (Email cap fix)    ──┼── Batch 1 (parallel -- SR to confirm)
TASK-2061 (Attachment names) ──┘
```

No cross-task dependencies. All tasks branch from `develop` and target `develop`.

---

## Risks

| Risk | Mitigation |
|------|-----------|
| TASK-2059 + TASK-2060 conflict in emailSyncHandlers.ts | SR Technical Review confirms parallel safety. If not safe, run sequentially. |
| Email provider APIs may not support date filtering as expected | TASK-2060 includes investigation step. If unsupported, fall back to larger maxResults. |
| Sentry import in renderer may cause issues | Sentry renderer is already initialized in main.tsx (confirmed). |

---

## Sprint Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| Total Estimated Tokens | ~165K | ~110K (engineering) |
| Number of Tasks | 3 | 3 |
| Parallel Tasks | 3 (if SR confirms) | 3 (parallel confirmed) |
| Expected Duration | 1 session (overnight) | 1 session |

---

## Retrospective

**Date:** 2026-02-23
**Status:** All tasks completed and merged to develop.

### PRs Merged

| Task | PR | Merged |
|------|-----|--------|
| TASK-2059 (Sentry sync instrumentation) | #954 | 2026-02-23 |
| TASK-2060 (email 200-cap fix) | #955 | 2026-02-23 |
| TASK-2061 (attachment folder names) | #953 | 2026-02-23 |

### QA Findings

All 3 tasks passed QA. The following backlog items were added during QA:

- **BACKLOG-806:** Fix Sentry custom tags using `withScope` (from TASK-2059). `captureException` calls were dead code due to `@sentry/electron` auto-capture deduplication. 5 calls removed in cleanup (PR #954 amended), 17 breadcrumbs kept.
- **BACKLOG-807:** Export progress counter and parallel workers (from TASK-2061).
- **BACKLOG-808:** Non-PDF email attachments not exported (from TASK-2061).
- **BACKLOG-809:** Manually added contact not immediately selectable (from TASK-2060).
- **BACKLOG-810:** Sync progress bar in transaction email tab (from TASK-2060).

### Notable Observations

- TASK-2059 had a significant finding during QA: `captureException` calls are dead code because `@sentry/electron` auto-capture deduplicates exceptions. All 5 `captureException` calls were removed, keeping only the 17 `addBreadcrumb` calls. BACKLOG-806 tracks the `withScope` follow-up for when tag-based filtering is needed.
- TASK-2061 came in well under estimate (~15K vs ~25K). The attachment folder naming fix was straightforward.
- TASK-2060 discovered that `outlookFetchService.searchEmails` and `gmailFetchService.searchEmails` already supported `after` parameter -- only `searchSentEmailsToContacts` needed the new parameter. Transaction model uses `started_at` (not `audit_start_date` as assumed in the task file).
- All 3 tasks ran in parallel with no conflicts, confirming SR's parallel safety assessment.
