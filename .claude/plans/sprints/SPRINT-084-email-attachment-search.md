# SPRINT-084: Email Attachment Search Improvements

**Created:** 2026-02-15
**Status:** In Progress
**Branch:** `sprint/084-email-attachment-search`
**Base:** `develop`

---

## Sprint Goal

Upgrade the "Attach Emails" modal from a dumb 100-email dump with client-side search to a proper server-side search experience with free text query, audit period date filtering, and progressive "load more" pagination.

## Sprint Narrative

When a user opens the "Attach Emails" modal on a transaction, the app currently fetches the most recent 100 emails from their provider (Gmail or Outlook) with no filtering -- then does client-side string matching on subject/sender only. This means:

1. Users cannot search email body content
2. Users cannot narrow results to the audit period (started_at/closed_at)
3. Only 100 emails are fetched -- older relevant emails are invisible
4. The search box gives a false impression of searching the mailbox when it only filters what was already fetched

The fix is straightforward because both `gmailFetchService.searchEmails()` and `outlookFetchService.searchEmails()` already accept `query`, `after`, `before`, and `maxResults` parameters. The work is purely wiring: pass these params from the modal through the preload bridge and IPC handler down to the existing backend services.

---

## In-Scope

| ID | Title | Task | PR | Status |
|----|-------|------|-----|--------|
| BACKLOG-702 | Email attachment search: free text + date filter + load more | TASK-1993 | - | In Progress |
| BACKLOG-703 | Manual test: Outlook email search improvements | TASK-1994 | - | Pending |

**Total Estimated Tokens:** ~35K (engineering) + ~20K (SR review overhead) = ~55K

## Out-of-Scope / Deferred

- Auto-link emails to transactions based on contact matching (BACKLOG-635)
- Gmail contacts import (Outlook only for now)
- Full email sync/indexing -- this is still a live-search-from-provider approach
- Email body preview in search results (body_preview is already returned but not displayed; display can be a follow-up)

---

## Phase Plan

### Phase 1: Email Search Wiring (Single Task)

This is one cohesive feature spanning 3 layers (frontend, preload bridge, backend handler). Splitting across tasks would create interface mismatches and merge conflicts.

```
Phase 1: Email Attachment Search
+-- TASK-1993: Wire server-side search params through all layers
|   1. Update IPC handler to accept query/after/before/maxResults
|   2. Update preload bridge to pass search params
|   3. Update AttachEmailsModal to use server-side search
+-- CI gate: type-check, lint, test all pass
```

**TASK-1993** (BACKLOG-702): Email attachment search improvements
- Touches: `electron/transaction-handlers.ts`, `electron/preload/transactionBridge.ts`, `src/components/transactionDetailsModule/components/modals/AttachEmailsModal.tsx`
- Backend services already support all needed params -- just wiring

### Phase 2: Manual Testing (After Phase 1 Merge)

```
Phase 2: Verification
+-- TASK-1994: Manual test of Outlook email search
+-- Depends on TASK-1993 being merged
```

**TASK-1994** (BACKLOG-703): Manual test of Outlook email search improvements
- Verify TASK-1992 search fix from SPRINT-083 works as expected
- Verify TASK-1993 search improvements work end-to-end
- Test free text search, date filtering, load more pagination

---

## Dependency Graph

```
TASK-1993 (Email search wiring)
    |
    v
TASK-1994 (Manual testing)
    |
    v
Sprint Complete
```

**Execution Order:**
1. TASK-1993 (engineering)
2. TASK-1994 (manual test -- after TASK-1993 merged)

---

## Merge Plan

All tasks branch from `develop` and merge back to `develop` via PR.

| Task | Branch Name | Base | Target |
|------|-------------|------|--------|
| TASK-1993 | `feature/task-1993-email-search-wiring` | develop | develop |
| TASK-1994 | N/A (manual test, no code changes expected) | - | - |

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Gmail query syntax differs from Outlook OData filters | Low | Low | Both services already handle their own query building internally -- we just pass a plain text query string |
| Large result sets from server-side search may slow UI | Medium | Low | Existing THREADS_PER_PAGE pagination in modal handles display; backend maxResults caps API calls |
| Race conditions from rapid typing in search | Low | Medium | Add debounce to search input (standard pattern) |
| Transaction audit period dates may be null | Low | High | Handle gracefully -- show date filter only when dates exist, or allow manual date entry |

---

## Testing & Quality Plan

### Per-Task Testing Requirements

| Task | Unit Tests | Integration Tests | Manual Testing |
|------|-----------|-------------------|----------------|
| TASK-1993 | Test IPC handler accepts new params; test modal search triggers fetch | N/A | Search for email by body text, filter by date range, use load more |
| TASK-1994 | N/A | N/A | Full manual verification checklist |

### CI Gates (All Tasks)

- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] No regressions in existing tests

---

## End-of-Sprint Validation Checklist

- [ ] Free text search in Attach Emails modal searches server-side (subject + body + sender)
- [ ] Audit period date filter narrows email results to transaction date range
- [ ] "Load more" fetches additional emails from provider (not just showing hidden local results)
- [ ] Search works for both Gmail and Outlook providers
- [ ] Existing email attachment flow still works (select + attach)
- [ ] All PRs merged to develop
- [ ] Backlog CSV updated

---

## Notes

### Uncommitted SPRINT-083 Polish

The `sprint/083-outlook-contacts-polish` branch has uncommitted polish changes from user testing that need a separate PR to develop. These are independent of SPRINT-084 work and should be committed/merged first or in parallel.
