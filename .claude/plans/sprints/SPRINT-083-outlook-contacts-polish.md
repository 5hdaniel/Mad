# SPRINT-083: Outlook Integration & Contacts Import UI Polish

**Created:** 2026-02-14
**Completed:** 2026-02-15
**Status:** Complete
**Branch:** `sprint/083-outlook-contacts-polish`
**Base:** `develop`

---

## Sprint Goal

Fix Outlook integration gaps and expand the contacts import UI from a macOS-only section to a unified multi-source experience. Address missing filter toggles, wiring gaps, and the stubbed "Check for Updates" button.

## Sprint Narrative

Users have reported that Outlook contacts and email search are not working as expected, despite backend implementations existing from SPRINT-073 and SPRINT-079. The issues are primarily UI wiring gaps: no Outlook filter toggle in contact search, no Settings UI to trigger Outlook contacts import, and a hardcoded-disabled "Check for Updates" button. This sprint leverages existing backend code (do NOT redo Graph API work) and focuses on UI/UX polish to surface existing functionality.

---

## In-Scope

| ID | Title | Task | PR | Status |
|----|-------|------|-----|--------|
| BACKLOG-697 | Add Outlook filter toggle to ContactSearchList | TASK-1988 | #857 | Merged 2026-02-15 |
| BACKLOG-698 | Expand contacts import settings to multi-source | TASK-1989 | #860 | Merged 2026-02-15 |
| BACKLOG-699 | Wire Check for Updates button to updateService | TASK-1990 | #858 | Merged 2026-02-15 |
| BACKLOG-700 | Contact source stats breakdown in import settings | TASK-1991 | #861 | Merged 2026-02-15 |
| BACKLOG-701 | Outlook email search maxResults cap and contact filter | TASK-1992 | #859 | Merged 2026-02-15 |

**Total Estimated Tokens:** ~73K (engineering) + ~40K (SR review overhead) = ~113K

## Out-of-Scope / Deferred

- Redesigning the entire contact management flow (BACKLOG-418, BACKLOG-463)
- Auto-link search cloud email providers (BACKLOG-635) -- related but separate feature
- Gmail contacts import UI -- Outlook only for this sprint
- Sync orchestrator routing changes (BACKLOG-674) -- known issue, separate investigation
- Any Graph API backend changes to `outlookFetchService.ts` beyond adjusting maxResults default
- **Email attachment search improvement** (BACKLOG-702) -- deferred; needs free text search + audit period filtering + load more pagination

---

## Phase Plan

### Phase 1: Independent UI Fixes (Parallel)

These tasks touch different files and can run simultaneously.

```
Phase 1: Independent UI Fixes
+-- Parallel tasks: [TASK-1988, TASK-1990]
|   TASK-1988: Add Outlook filter toggle (ContactSearchList.tsx)
|   TASK-1990: Wire Check for Updates button (Settings.tsx + preload)
+-- Integration checkpoint: Both merged to develop
+-- CI gate: type-check, lint, test all pass
```

**TASK-1988** (BACKLOG-697): Add Outlook filter toggle to `ContactSearchList.tsx`
- Touches: `src/components/shared/ContactSearchList.tsx`
- SourcePill "outlook" variant already exists -- just wire the filter toggle
- Safe for parallel: different file from TASK-1990

**TASK-1990** (BACKLOG-699): Wire "Check for Updates" button
- Touches: `src/components/Settings.tsx`, `electron/preload/outlookBridge.ts` (updateBridge needs `checkForUpdates` method)
- Safe for parallel: different file from TASK-1988

### Phase 2: Contacts Import Expansion (Sequential after Phase 1)

These tasks modify the Settings contacts import section and share state.

```
Phase 2: Contacts Import Expansion
+-- Sequential: TASK-1989 -> TASK-1991
|   TASK-1989: Expand MacOSContactsImportSettings to multi-source (depends on filter toggle being merged)
|   TASK-1991: Add per-source stats breakdown (depends on TASK-1989)
+-- Integration checkpoint: Both merged to develop
+-- CI gate: type-check, lint, test all pass
```

**TASK-1989** (BACKLOG-698): Expand contacts import settings to multi-source
- Rename component from "macOS Contacts" to "Contacts Import"
- Show import controls for all connected sources (macOS Contacts, Outlook)
- Depends on TASK-1988 being merged (consistent Outlook terminology)

**TASK-1991** (BACKLOG-700): Add per-source stats breakdown
- Show added/modified/deleted counts per source
- Depends on TASK-1989 (UI scaffolding)

### Phase 3: Outlook Email Search Fix (Can start after Phase 1)

```
Phase 3: Backend Tuning
+-- Sequential: TASK-1992 (independent of Phase 2)
|   TASK-1992: Fix Outlook email search maxResults + contact filtering
+-- Integration checkpoint: Merged to develop
+-- CI gate: type-check, lint, test all pass
```

**TASK-1992** (BACKLOG-701): Fix Outlook email search cap
- Touches: `electron/services/outlookFetchService.ts` (searchEmails method only)
- Can run in parallel with Phase 2 (different files)

---

## Dependency Graph

```
TASK-1988 (Outlook filter toggle)     TASK-1990 (Check for Updates)
    |                                      |
    v                                      v
TASK-1989 (Multi-source import UI) -----> merge to develop
    |
    v
TASK-1991 (Source stats breakdown)        TASK-1992 (Email search fix)
    |                                      |
    v                                      v
    +------------ Sprint Complete ---------+
```

**Execution Order:**
1. **Batch 1 (Parallel):** TASK-1988, TASK-1990
2. **Batch 2 (Sequential):** TASK-1989 (after TASK-1988)
3. **Batch 3 (Parallel):** TASK-1991, TASK-1992

---

## Merge Plan

All tasks branch from `develop` and merge back to `develop` via PR.

| Task | Branch Name | Base | Target |
|------|-------------|------|--------|
| TASK-1988 | `fix/task-1988-outlook-filter-toggle` | develop | develop |
| TASK-1989 | `feature/task-1989-multi-source-import` | develop | develop |
| TASK-1990 | `fix/task-1990-check-for-updates` | develop | develop |
| TASK-1991 | `feature/task-1991-source-stats` | develop | develop |
| TASK-1992 | `fix/task-1992-outlook-email-search` | develop | develop |

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Outlook contacts import requires reconnection (scope lacking Contacts.Read) | Medium | Medium | Backend already handles this gracefully with `reconnectRequired` flag -- UI should surface this message |
| ContactSearchList has complex filter logic | Low | Low | Filter follows established pattern (manual/imported/external/messages) -- just adding one more |
| updateBridge lacks `checkForUpdates` IPC method | Low | High | Need to add IPC invoke method to preload bridge and register handler in main.ts |
| Settings.tsx is large and may cause merge conflicts with SPRINT-082 | Medium | Medium | SPRINT-082 does not touch Settings.tsx update section -- verify before starting |

---

## Testing & Quality Plan

### Per-Task Testing Requirements

| Task | Unit Tests | Integration Tests | Manual Testing |
|------|-----------|-------------------|----------------|
| TASK-1988 | Update ContactSearchList filter tests | N/A | Verify Outlook contacts appear/hide with toggle |
| TASK-1989 | New tests for multi-source import component | N/A | Trigger import from each source, verify UI updates |
| TASK-1990 | N/A (simple wiring) | N/A | Click button, verify checking/result states |
| TASK-1991 | Test stats aggregation query | N/A | Verify counts match after sync |
| TASK-1992 | Test searchEmails with higher limits | N/A | Search for contact with many emails, verify results |

### CI Gates (All Tasks)

- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] No regressions in existing tests

---

## End-of-Sprint Validation Checklist

- [x] Outlook filter toggle visible in contact search lists
- [x] Contacts import settings section shows all connected sources
- [x] Per-source contact stats (added/modified/deleted) displayed
- [x] "Check for Updates" button works and shows result
- [x] Outlook email search returns results for contacts with many emails
- [x] All PRs merged to develop
- [x] Backlog CSV updated

---

## Completion Summary

**All 5 planned tasks completed and merged on 2026-02-15.**

| Task | PR | Merged |
|------|-----|--------|
| TASK-1988: Outlook filter toggle | #857 | 2026-02-15 00:29 UTC |
| TASK-1990: Check for Updates button | #858 | 2026-02-15 00:29 UTC |
| TASK-1992: Outlook email search fix | #859 | 2026-02-15 00:29 UTC |
| TASK-1989: Multi-source import settings | #860 | 2026-02-15 00:37 UTC |
| TASK-1991: Contact source stats | #861 | 2026-02-15 00:47 UTC |

### Additional Polish (User Testing Fixes - Uncommitted)

During user testing on 2026-02-15, the following additional fixes were made directly on the `sprint/083-outlook-contacts-polish` branch. These changes are uncommitted and need a PR to merge to develop:

1. **Force Re-import differentiation** -- Force Re-import now wipes ALL external_contacts then re-imports from enabled sources (vs Import which only adds new). Files: `externalContactDbService.ts`, `contact-handlers.ts`, `contactBridge.ts`, `MacOSContactsImportSettings.tsx`
2. **Info icon tooltip** -- Explains the difference between Import and Force Re-import
3. **Import calls syncExternal** -- macOS contacts repopulate correctly after force reimport
4. **Phone dedup fix** -- Uses last 10 digits for matching to handle E.164 vs raw format mismatch. File: `ContactSearchList.tsx`
5. **Hide "Not Imported" pill** -- When contact shows "Added", hide the redundant "Not Imported" pill. File: `ContactRow.tsx`
6. **Edit Contact button on Screen 1** -- EditContactsModal now opens edit form instead of just closing preview. File: `EditContactsModal.tsx`
7. **Stray "0" rendering fix** -- `is_message_derived` was `0` (number) rendering as visible text. File: `ContactFormModal.tsx`
8. **Default message sync changed** -- 50K messages / 3 months (was 250K / 6 months). Files: `MacOSMessagesImportSettings.tsx`, `messageImportHandlers.ts`
9. **Default Representation Start Date** -- Changed to 3 months ago (was 60 days). File: `useAuditTransaction.ts`

### Deferred to Backlog

- **BACKLOG-702**: Email attachment search improvement -- Currently limited to 100 emails; needs free text search across email body/subject, audit period date filtering, and paginated load-more instead of hard cap
