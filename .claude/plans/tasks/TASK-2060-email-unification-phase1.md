# Task TASK-2060: Email Unification Phase 1 -- Fix 200-Email Cap and Extract Shared Service

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**CRITICAL:** Creating a PR is step 3 of 7, not the final step. Task is NOT complete until PR is MERGED.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Fix the hardcoded `maxResults: 200` email cap in `emailSyncHandlers.ts` that silently drops older emails beyond the 200 most recent. This cap means transactions with contacts who have long email histories (e.g., a 2-year audit period) will miss emails outside the most recent 200. Replace the fixed cap with date-range filtering that covers the full audit period.

Additionally, extract the duplicated email fetch + store + dedup logic (repeated for Outlook inbox, Outlook sent, Outlook all-folders, Gmail search, Gmail all-labels) into a shared helper to reduce code duplication and make the logic consistent.

## Non-Goals

- Do NOT unify ALL 5 email operation paths into a single service (that is the full BACKLOG-786 scope -- this is Phase 1 only).
- Do NOT modify the auto-link logic (separate concern).
- Do NOT change the `transactions:scan` handler (that has its own `maxResults` handling with `effectiveMaxResults` at line 185 which is already configurable).
- Do NOT change the lookback settings consolidation (that is Phase 2 of BACKLOG-786).
- Do NOT fix the thread display "shows only one sender" issue (separate investigation).

## Prerequisites

**Sprint:** SPRINT-096
**Depends on:** Nothing directly. Can run in parallel with TASK-2059 (Sentry) if SR confirms no shared file conflicts.
**Blocks:** Nothing.

## Context

### The 200-Email Cap Problem

In `electron/handlers/emailSyncHandlers.ts`, the `transactions:sync-and-fetch-emails` handler (line ~893) fetches emails from providers with a hardcoded `maxResults: 200` in 4 places:

| Location | Line | Provider | Search Type |
|----------|------|----------|-------------|
| `outlookFetchService.searchEmails` | ~1014 | Outlook | Contact inbox |
| `outlookFetchService.searchAllFolders` | ~1026 | Outlook | All folders |
| `gmailFetchService.searchEmails` | ~1135 | Gmail | Contact search |
| `gmailFetchService.searchAllLabels` | ~1147 | Gmail | All labels |

Plus `maxResults: 50` for Outlook sent items (line ~1019).

The result: only the 200 most recent emails are fetched per search. For a transaction with a 2-year audit period, emails from early in the period are never retrieved. Real example: 571 Dale transaction -- an email with attachment "571 Dale Insurance memo.pdf" from March 2024 was missing because it fell outside the 200 most recent.

### The Fix

Replace `maxResults: 200` with date-range filtering. The email providers' APIs support date filtering:
- Outlook Graph API: `$filter=receivedDateTime ge 2024-01-01`
- Gmail API: `after:2024/01/01` in the query parameter

The date range should be derived from the transaction's audit period (available from `transactionDetails`).

### Code Duplication

The same fetch-store-dedup pattern is repeated 5 times in the handler (Outlook inbox, Outlook sent, Outlook all-folders, Gmail inbox, Gmail all-labels). Each repetition:
1. Fetches emails from provider
2. Deduplicates by external ID
3. Iterates and calls `createEmail()` + `createCommunication()` for each
4. Downloads attachments
5. Tracks counts

This should be extracted to a shared helper function.

## Requirements

### Must Do:

1. **Replace maxResults cap with date-range filtering**:
   - Read the transaction's audit period from `transactionDetails` (the transaction object has date fields)
   - Calculate a date range: from `audit_start_date` (or created_at minus lookback) to today
   - Pass the date range to `outlookFetchService.searchEmails()` and `gmailFetchService.searchEmails()`
   - Keep a reasonable upper cap (e.g., `maxResults: 1000`) as a safety valve, but make it much higher than 200
   - If the fetch services don't support date filtering yet, add the parameter

2. **Check if outlookFetchService.searchEmails supports date filtering**:
   - Read `electron/services/outlookFetchService.ts` to see if it accepts a `since` or `receivedAfter` parameter
   - If not, add one: modify the Graph API query to include `$filter=receivedDateTime ge '${isoDate}'`
   - Similarly check `gmailFetchService.searchEmails` -- Gmail supports `after:YYYY/MM/DD` in the query string

3. **Extract shared email fetch-store helper**:
   - Create a helper function (can be in the same file or a new helper):
     ```typescript
     async function fetchStoreAndDedup(params: {
       provider: 'outlook' | 'gmail';
       fetchFn: () => Promise<ProviderEmail[]>;
       userId: string;
       transactionId: string;
       seenIds: Set<string>;
     }): Promise<{ fetched: number; stored: number; errors: number }>
     ```
   - This function handles: fetch, dedup against seenIds, createEmail + createCommunication, attachment download, error counting
   - Replace the 5 duplicated blocks with calls to this helper

4. **Add the date range to the sent items search too**:
   - The `searchSentEmailsToContacts` call at line ~1017 uses maxResults:50 -- also needs date filtering

5. **Preserve network resilience**:
   - The existing `retryOnNetwork()` wrappers MUST be preserved
   - The individual email save pattern (save each email individually, not in batch) MUST be preserved per TASK-2049

### Must NOT Do:

- Modify the `transactions:scan` handler
- Change auto-link logic
- Remove the dedup-by-external-ID logic
- Change the IPC channel name or response shape

## Acceptance Criteria

- [ ] The hardcoded `maxResults: 200` is replaced with date-range filtering based on transaction audit period
- [ ] A safety cap of 1000+ exists to prevent runaway fetches
- [ ] Outlook email fetch uses date filtering via Graph API `$filter`
- [ ] Gmail email fetch uses date filtering via `after:` query modifier
- [ ] Sent items search also uses date filtering (not just maxResults:50)
- [ ] Duplicated fetch-store-dedup code is extracted to a shared helper
- [ ] All 5 provider fetch calls (Outlook inbox, sent, all-folders, Gmail search, all-labels) use the shared helper
- [ ] Network resilience (retryOnNetwork) is preserved
- [ ] Individual email save pattern is preserved
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Deliverables

### Files to Create

| File | Purpose |
|------|---------|
| None required, but optionally `electron/handlers/emailFetchHelpers.ts` | Shared fetch-store-dedup helper (alternative: keep in emailSyncHandlers.ts) |

### Files to Modify

| File | Changes |
|------|---------|
| `electron/handlers/emailSyncHandlers.ts` | Replace maxResults:200 with date filtering, extract shared helper, refactor 5 fetch blocks |
| `electron/services/outlookFetchService.ts` | Add `receivedAfter?: string` parameter to `searchEmails()` and `searchAllFolders()`, modify Graph API query |
| `electron/services/gmailFetchService.ts` | Add `after?: string` parameter to `searchEmails()` and `searchAllLabels()`, modify Gmail query string |

### Files to Read (for context)

| File | Why |
|------|-----|
| `electron/handlers/emailSyncHandlers.ts` (lines 893-1300) | Full sync-and-fetch-emails handler to understand current flow |
| `electron/services/outlookFetchService.ts` | Understand current searchEmails API and Graph query construction |
| `electron/services/gmailFetchService.ts` | Understand current searchEmails API and Gmail query construction |
| `electron/services/transactionService.ts` | Understand how to get transaction audit dates |
| `electron/services/db/emailDbService.ts` | Understand createEmail signature |
| `electron/services/db/communicationDbService.ts` | Understand createCommunication signature |

## Implementation Notes

### Transaction date fields

Read the transaction to get the audit period:
```typescript
// transactionDetails is already fetched at line ~912
const auditStartDate = transactionDetails.audit_start_date
  || transactionDetails.created_at;
// Use this as the "since" date for email fetching
```

Check what date fields are available on the transaction object. Common fields: `audit_start_date`, `audit_end_date`, `created_at`, `closing_date`.

### Outlook Graph API date filter

```typescript
// In outlookFetchService.searchEmails:
const filterParts = [];
if (options.receivedAfter) {
  filterParts.push(`receivedDateTime ge '${options.receivedAfter}'`);
}
// Add to existing $filter if any
```

### Gmail date filter

```typescript
// In gmailFetchService.searchEmails:
if (options.after) {
  // Gmail uses YYYY/MM/DD format
  query += ` after:${options.after}`;
}
```

### Safety cap

Even with date filtering, keep a maxResults cap (e.g., 2000) to prevent unbounded fetches for contacts with extremely high email volume. Log a warning if the cap is hit so we know the user may have missing emails.

## Testing Expectations

### Unit Tests

- **Required:** Yes, update existing tests if they mock the handler
- **New tests to write:**
  1. Verify date range is calculated from transaction audit period
  2. Verify the shared helper correctly deduplicates
  3. Verify maxResults safety cap is applied

### CI Requirements

- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

## Estimation

- **Category:** refactor + fix (touching 3 service files + handler)
- **Base estimate:** ~50K tokens
- **SR overhead:** +15K
- **Final estimate:** ~65K tokens
- **Token Cap:** 260K (4x of 65K)

## PR Preparation

- **Title:** `fix(email): replace 200-email cap with date-range filtering and extract shared helper`
- **Branch:** `fix/task-2060-email-cap-date-filter`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: [state before]
- **After**: [state after]
- **Actual Tokens**: ~XK (Est: 65K)
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- Transaction objects don't have audit date fields (need to find alternative date source)
- The Outlook Graph API `$filter` syntax doesn't support `receivedDateTime ge` as expected
- The Gmail API `after:` query modifier doesn't work as expected
- `outlookFetchService.ts` or `gmailFetchService.ts` are too complex to modify safely (> 500 lines each)
- The handler is used by other code paths that depend on the current maxResults behavior
- More than 5 files need modification (scope creep)
- Existing tests fail in ways unrelated to this change
