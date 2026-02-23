# SPRINT-096: Sentry + Email Unification

**Created:** 2026-02-22
**Status:** Planned
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
| BACKLOG-795 | Sentry instrumentation for all sync paths | TASK-2059 | 1 (parallel) | ~30K | - | - | - | Pending |
| BACKLOG-786 | Email unification Phase 1 -- fix 200-email cap | TASK-2060 | 1 (parallel) | ~65K | - | - | - | Pending |
| BACKLOG-785 | Human-readable attachment folder names | TASK-2061 | 1 (parallel) | ~25K | - | - | - | Pending |

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

| Metric | Target |
|--------|--------|
| Total Estimated Tokens | ~165K |
| Number of Tasks | 3 |
| Parallel Tasks | 3 (if SR confirms) |
| Expected Duration | 1 session (overnight) |
