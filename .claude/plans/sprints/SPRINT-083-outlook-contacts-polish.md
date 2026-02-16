# SPRINT-083: Outlook Integration & Contacts Import UI Polish

**Created:** 2026-02-14
**Completed:** -
**Status:** In Progress
**Branch:** `sprint/083-outlook-contacts-polish`
**Base:** `develop`

---

## Sprint Goal

Fix Outlook integration gaps and expand the contacts import UI from a macOS-only section to a unified multi-source experience. Address missing filter toggles, wiring gaps, and the stubbed "Check for Updates" button. Additionally, fix email sync, auto-link, and contact data issues discovered during user testing.

## Sprint Narrative

Users have reported that Outlook contacts and email search are not working as expected, despite backend implementations existing from SPRINT-073 and SPRINT-079. The issues are primarily UI wiring gaps: no Outlook filter toggle in contact search, no Settings UI to trigger Outlook contacts import, and a hardcoded-disabled "Check for Updates" button. This sprint leverages existing backend code (do NOT redo Graph API work) and focuses on UI/UX polish to surface existing functionality.

**Update (2026-02-15):** User testing after Phases 1-3 revealed additional issues: auto-link was using wrong lookup fields, sent emails were not being synced, contact email editing had UNIQUE constraint errors, `getContactById` only returned the primary email, transaction details had a UI freeze, and email body preview disappeared from the Attach Emails modal. These are tracked as TASK-1996 (grouped fixes), TASK-1997 (perf), and TASK-1998 (regression).

---

## In-Scope

| ID | Title | Task | PR | Status |
|----|-------|------|-----|--------|
| BACKLOG-697 | Add Outlook filter toggle to ContactSearchList | TASK-1988 | #857 | Merged 2026-02-15 |
| BACKLOG-698 | Expand contacts import settings to multi-source | TASK-1989 | #860 | Merged 2026-02-15 |
| BACKLOG-699 | Wire Check for Updates button to updateService | TASK-1990 | #858 | Merged 2026-02-15 |
| BACKLOG-700 | Contact source stats breakdown in import settings | TASK-1991 | #861 | Merged 2026-02-15 |
| BACKLOG-701 | Outlook email search maxResults cap and contact filter | TASK-1992 | #859 | Merged 2026-02-15 |
| BACKLOG-706 | Auto-link creates wrong communication records | TASK-1996 | - | In Progress (code done) |
| BACKLOG-707 | Sync only searched inbox, not sent items | TASK-1996 | - | In Progress (code done) |
| BACKLOG-708 | Contact email edit UNIQUE constraint error | TASK-1996 | - | In Progress (code done) |
| BACKLOG-709 | getContactById only returns primary email | TASK-1996 | - | In Progress (code done) |
| BACKLOG-705 | UI freeze when opening transaction details | TASK-1997 | - | Pending |
| BACKLOG-710 | Email preview missing from Attach Emails modal | TASK-1998 | - | In Progress |
| BACKLOG-711 | Load More in Attach Emails shows out-of-order dates | TASK-1998 | - | In Progress |
| BACKLOG-712 | Attach Emails search should filter by transaction contacts | TASK-1998 | - | In Progress |
| BACKLOG-704 | Multi-email and multi-phone editing in contact form | TASK-1995 | - | Pending |

**Total Estimated Tokens:**
- Phases 1-3 (done): ~73K
- TASK-1996 (grouped fixes, code done): ~15K
- TASK-1997 (perf fix): ~30K
- TASK-1998 (email preview regression): ~10K
- TASK-1995 (multi-email/phone edit): ~35K
- **Sprint total:** ~163K (engineering) + ~80K (SR review overhead) = ~243K

## Out-of-Scope / Deferred

- Redesigning the entire contact management flow (BACKLOG-418, BACKLOG-463)
- Auto-link search cloud email providers (BACKLOG-635) -- related but separate feature
- Gmail contacts import UI -- Outlook only for this sprint
- Sync orchestrator routing changes (BACKLOG-674) -- known issue, separate investigation
- **Email attachment search improvement** (BACKLOG-702) -- deferred to SPRINT-084; needs free text search + audit period filtering + load more pagination

---

## Phase Plan

### Phase 1: Independent UI Fixes (Parallel) -- COMPLETE

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

### Phase 2: Contacts Import Expansion (Sequential after Phase 1) -- COMPLETE

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

### Phase 3: Outlook Email Search Fix (Can start after Phase 1) -- COMPLETE

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

### Phase 4: User Testing Fixes (Code Done, Needs PR) -- CURRENT

```
Phase 4: User Testing Fixes
+-- TASK-1996: Grouped email sync + contact data fixes (code done on current branch)
|   - Fix 1: Auto-link communication record lookup (autoLinkService.ts)
|   - Fix 2: Sync sent items, not just inbox (outlookFetchService.ts, transaction-handlers.ts)
|   - Fix 3: UNIQUE constraint on contact email edit (contact-handlers.ts)
|   - Fix 4: getContactById returns all emails/phones (contactDbService.ts)
+-- Plus: Sprint branch polish fixes (items 1-9 from Additional Polish section)
+-- Single PR for all grouped fixes
+-- CI gate: type-check, lint, test all pass
```

**TASK-1996** (BACKLOG-706, 707, 708, 709): Grouped email sync and contact data fixes
- All code is already written on the current branch
- Files changed: `autoLinkService.ts`, `outlookFetchService.ts`, `transaction-handlers.ts`, `contact-handlers.ts`, `contactDbService.ts`
- Should be combined with the Additional Polish items (force re-import, phone dedup, etc.) into a single PR

### Phase 5: Investigation + Targeted Fixes (Sequential after Phase 4)

```
Phase 5: Remaining Fixes
+-- TASK-1998: Investigate + fix email preview regression (may be quick)
+-- TASK-1997: Transaction details UI freeze (performance fix)
|   These are independent and can run in parallel, but both depend on Phase 4 being merged
+-- CI gate: type-check, lint, test all pass
```

**TASK-1998** (BACKLOG-710): Email preview missing from Attach Emails modal
- Needs investigation first -- may be a missing `$select` field or a rendering issue
- Likely a quick fix once root cause is found
- ~10K estimated tokens

**TASK-1997** (BACKLOG-705): UI freeze when opening transaction details
- 4 root causes identified: N+1 subqueries, ALL contacts fetch, hook re-renders, sync handler side effects
- Larger fix: new IPC handler, query rewrites, hook consolidation
- ~30K estimated tokens

### Phase 6: Contact Form Multi-Edit (Sequential after Phase 5)

```
Phase 6: Contact Form Enhancement
+-- Sequential: TASK-1995 (depends on all prior fixes being merged to develop)
|   TASK-1995: Multi-email and multi-phone editing in ContactFormModal
+-- Integration checkpoint: Merged to develop
+-- CI gate: type-check, lint, test all pass
```

**TASK-1995** (BACKLOG-704): Multi-email and multi-phone editing in contact form
- Touches: `ContactFormModal.tsx`, `contact-handlers.ts`, `contactDbService.ts`, `src/types/components.ts`
- Requires: All prior fixes merged to develop first (especially TASK-1996 which changes `contact-handlers.ts` and `contactDbService.ts`)
- Standalone task: no dependency on TASK-1997/1998 functionally, but shared files require sequential execution

---

## Dependency Graph

```
TASK-1988 (Outlook filter)     TASK-1990 (Check for Updates)
    |                               |
    v                               v
TASK-1989 (Multi-source UI)    merge to develop
    |
    v
TASK-1991 (Source stats)       TASK-1992 (Email search fix)
    |                               |
    v                               v
    +------ Phases 1-3 Complete ----+
                    |
                    v
           TASK-1996 (Grouped email sync + contact fixes)
           + Sprint branch polish fixes
                    |
                    v
              Phase 4 PR merged
                    |
         +----------+----------+
         |                     |
         v                     v
    TASK-1998              TASK-1997
    (Email preview)        (Transaction perf)
         |                     |
         v                     v
         +---- Phase 5 Complete ---+
                    |
                    v
           TASK-1995 (Multi-email/phone edit)
                    |
                    v
             Sprint Complete
```

**Execution Order:**
1. **Batch 1 (Parallel):** TASK-1988, TASK-1990 -- DONE
2. **Batch 2 (Sequential):** TASK-1989 (after TASK-1988) -- DONE
3. **Batch 3 (Parallel):** TASK-1991, TASK-1992 -- DONE
4. **Batch 4 (Single PR):** TASK-1996 + sprint polish fixes -- CURRENT (code done, needs PR)
5. **Batch 5 (Parallel possible):** TASK-1998, TASK-1997 -- after Batch 4 merged
6. **Batch 6 (Sequential):** TASK-1995 -- after Batch 5 merged (shared files)

---

## Merge Plan

All tasks branch from `develop` and merge back to `develop` via PR.

| Task | Branch Name | Base | Target | Status |
|------|-------------|------|--------|--------|
| TASK-1988 | `fix/task-1988-outlook-filter-toggle` | develop | develop | Merged |
| TASK-1989 | `feature/task-1989-multi-source-import` | develop | develop | Merged |
| TASK-1990 | `fix/task-1990-check-for-updates` | develop | develop | Merged |
| TASK-1991 | `feature/task-1991-source-stats` | develop | develop | Merged |
| TASK-1992 | `fix/task-1992-outlook-email-search` | develop | develop | Merged |
| TASK-1996 | `fix/task-1996-email-sync-contact-fixes` | develop | develop | Needs PR |
| TASK-1997 | `fix/task-1997-transaction-details-perf` | develop | develop | Pending |
| TASK-1998 | `fix/task-1998-email-preview-regression` | develop | develop | Pending |
| TASK-1995 | `feature/task-1995-multi-email-phone-edit` | develop | develop | Pending |

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Outlook contacts import requires reconnection (scope lacking Contacts.Read) | Medium | Medium | Backend already handles this gracefully with `reconnectRequired` flag -- UI should surface this message |
| ContactSearchList has complex filter logic | Low | Low | Filter follows established pattern (manual/imported/external/messages) -- just adding one more |
| updateBridge lacks `checkForUpdates` IPC method | Low | High | Need to add IPC invoke method to preload bridge and register handler in main.ts |
| Settings.tsx is large and may cause merge conflicts with SPRINT-082 | Medium | Medium | SPRINT-082 does not touch Settings.tsx update section -- verify before starting |
| ContactFormModal has uncommitted sprint branch changes (stray "0" fix) | Medium | High | Must merge sprint branch polish to develop before starting TASK-1995, otherwise base will be stale |
| contacts:update backward compat with old single-email payload | Medium | Low | Task spec requires backward compat: only use array logic when `emails[]` present in payload |
| TASK-1996 grouped PR is large (many files) | Medium | Medium | All changes are already tested manually; risk is CI failures from combined diffs |
| TASK-1997 perf fix touches shared files (contactDbService, contact-handlers) | Medium | High | Must be sequential before TASK-1995 to avoid merge conflicts |
| TASK-1998 root cause unknown | Low | Medium | May be a simple $select fix or may require deeper investigation |

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
| TASK-1996 | Existing tests must pass | N/A | Verify auto-link, sent email sync, email edit, contact detail display |
| TASK-1997 | getTransactionContacts JOIN query, contacts:get-by-ids | N/A | Open transaction details, verify no freeze |
| TASK-1998 | N/A (depends on root cause) | N/A | Verify email body preview visible in Attach Emails modal |
| TASK-1995 | ContactFormModal multi-email/phone rendering, add/remove/primary tests; backend array update tests | N/A | Edit contact with multiple emails/phones, add new, remove, change primary |

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
- [ ] Auto-link creates proper communication records
- [ ] Sent emails synced alongside inbox emails
- [ ] Contact email edit handles existing emails gracefully
- [ ] getContactById returns all emails and phones
- [ ] Transaction details opens without UI freeze
- [ ] Email body preview visible in Attach Emails modal
- [ ] Contact edit form shows all emails/phones with add/remove/primary controls
- [x] All Phase 1-3 PRs merged to develop
- [ ] All Phase 4-6 PRs merged to develop
- [x] Backlog CSV updated

---

## Completion Summary

**Phases 1-3: All 5 original tasks completed and merged on 2026-02-15. Phases 4-6 in progress.**

| Task | PR | Merged |
|------|-----|--------|
| TASK-1988: Outlook filter toggle | #857 | 2026-02-15 00:29 UTC |
| TASK-1990: Check for Updates button | #858 | 2026-02-15 00:29 UTC |
| TASK-1992: Outlook email search fix | #859 | 2026-02-15 00:29 UTC |
| TASK-1989: Multi-source import settings | #860 | 2026-02-15 00:37 UTC |
| TASK-1991: Contact source stats | #861 | 2026-02-15 00:47 UTC |
| TASK-1996: Email sync + contact fixes | - | Pending (code done) |
| TASK-1997: Transaction details perf | - | Pending |
| TASK-1998: Email preview regression | - | Pending |
| TASK-1995: Multi-email/phone edit | - | Pending |

### Additional Polish (User Testing Fixes - Uncommitted)

During user testing on 2026-02-15, the following additional fixes were made directly on the `sprint/083-outlook-contacts-polish` branch. These changes are uncommitted and need a PR to merge to develop (will be included in TASK-1996 PR):

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

---

## Sprint Closure

**Closed:** 2026-02-15
**Closed By:** PM Agent

All 5 planned tasks (TASK-1988 through TASK-1992) have been implemented, reviewed, and merged. Additional polish fixes from user testing session are tracked on the sprint branch (PR #862). Backlog items BACKLOG-697 through BACKLOG-701 marked Completed.

Two new bugs discovered during user testing have been logged to the backlog:
- **BACKLOG-704**: Edit Contact modal doesn't save email or phone updates (High priority)
- **BACKLOG-705**: Removed Outlook contact not visible in UI after re-import (Medium priority)
