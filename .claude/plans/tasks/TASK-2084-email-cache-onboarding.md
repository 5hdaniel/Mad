# Task TASK-2084: Add Initial Email Cache Creation During Onboarding

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/docs/shared/pr-lifecycle.md`.

---

## Goal

During onboarding, create a local cache of the user's past 3 months of emails so that email search, auto-linking, and transaction views work immediately without requiring a manual sync. Currently, the onboarding 'emails' sync type (`transactions.scan`) only runs AI transaction detection -- it does NOT fetch and store emails locally. The email cache duration should respect the user's `emailCache.durationMonths` preference (default: 3 months, configurable in Settings).

## Non-Goals

- Do NOT change the email cache duration Settings UI (it already exists)
- Do NOT modify the SyncOrchestrator service architecture
- Do NOT add email cache cleanup/retention logic (follow-up task)
- Do NOT change the AI transaction detection flow
- Do NOT add Gmail email fetching if it is not already implemented in the fetch service
- Do NOT block the onboarding flow -- email fetch must run in background

## Deliverables

1. Update: `src/services/SyncOrchestratorService.ts` -- Add an `email-cache` sync type (or extend the existing `emails` sync type) that fetches and stores emails locally
2. Update: `src/hooks/useAutoRefresh.ts` -- Include `email-cache` in the auto-refresh sync types for onboarding completion
3. Update: `src/components/onboarding/steps/PermissionsStep.tsx` -- Add email cache to the onboarding sync request (if appropriate)
4. Investigate: `electron/handlers/emailSyncHandlers.ts` -- Understand the existing email fetch + store flow and reuse it

## Acceptance Criteria

- [ ] After onboarding completes, past 3 months of emails are fetched from connected provider (Outlook/Gmail) and stored locally
- [ ] Email fetch runs in background -- does not block Dashboard transition
- [ ] Email fetch respects the `emailCache.durationMonths` user preference (default: 3 months)
- [ ] Emails are stored in the local SQLite database (same format as existing email storage)
- [ ] After cache is built, transaction email tabs show results without needing manual sync
- [ ] If email provider is not connected, email cache step is silently skipped
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Implementation Notes

### Current Email Sync Architecture

The existing `emails` sync type in SyncOrchestrator calls `window.api.transactions.scan(userId)` which:
1. Fetches recent emails from Outlook/Gmail
2. Runs AI transaction detection on them
3. Creates pending transactions
4. Does NOT store the raw emails locally for search

The local email storage is handled by `emailSyncHandlers.ts` which has methods like:
- `syncAndFetchEmails` -- fetches emails for a specific transaction's contacts
- Various fetch functions in `OutlookFetchService` and `GmailFetchService`

### Proposed Approach

The engineer should investigate the existing email fetch infrastructure in `electron/handlers/emailSyncHandlers.ts` to find the best approach. Options:

**Option A: Add new IPC handler for bulk email cache**
Create a new IPC handler `emails.cacheRecent(userId, months)` that:
1. Gets all connected email accounts
2. Fetches emails from the past N months
3. Stores them in the local `emails` table
4. Returns count of emails cached

**Option B: Reuse existing fetchAndStoreEmails with broad parameters**
If `emailSyncHandlers.ts` has a function that fetches emails for given contacts/date range, call it with all contacts and the lookback period.

**Option C: Register a new sync function in SyncOrchestrator**
Add an `email-cache` sync type that runs after `contacts` and `emails` in the onboarding sync queue.

The engineer should explore the codebase and choose the approach that reuses the most existing code. Do not create new email fetching logic from scratch -- leverage existing `OutlookFetchService` and `GmailFetchService`.

### Key Files to Explore

```
electron/handlers/emailSyncHandlers.ts  -- Main email sync handler
electron/services/OutlookFetchService.ts -- Outlook email fetching
electron/services/GmailFetchService.ts   -- Gmail email fetching
src/components/Settings.tsx              -- emailCache.durationMonths preference
src/services/SyncOrchestratorService.ts  -- Where to register the new sync
```

### Integration with Onboarding

After TASK-2083 ensures contacts sync runs during onboarding, this task adds email cache to the same flow:

```typescript
// In PermissionsStep or OnboardingFlow.handleComplete:
requestSync(['contacts', 'emails', 'messages'], userId);
// OR if using new sync type:
requestSync(['contacts', 'email-cache', 'messages'], userId);
```

### Email Cache Duration

The Settings already have `emailCache.durationMonths` (default 3). Read this preference:

```typescript
const result = await window.api.preferences.get(userId);
const months = result.preferences?.emailCache?.durationMonths || 3;
```

## Integration Notes

- Depends on TASK-2083 (contacts sync fix) -- contacts must sync first so we have contact email addresses to fetch
- Uses existing email fetch services in electron/handlers/
- Related: BACKLOG-786 (email operations refactor) -- this task should not conflict since we are adding a new sync type, not refactoring existing ones

## Do / Don't

### Do:
- Reuse existing email fetch infrastructure (OutlookFetchService, GmailFetchService)
- Run the email cache in background (non-blocking)
- Respect the user's email cache duration preference
- Handle the case where no email provider is connected (skip gracefully)
- Add progress reporting to SyncOrchestrator

### Don't:
- Do NOT create new email fetching logic from scratch
- Do NOT block the Dashboard/onboarding transition
- Do NOT fetch more emails than the user's configured cache duration
- Do NOT modify the AI transaction detection flow
- Do NOT implement email cache cleanup/retention (follow-up)

## When to Stop and Ask

- If the existing email fetch services don't support a "fetch all recent emails" mode (only transaction-scoped)
- If creating the email cache requires schema changes to the emails table
- If the task exceeds 40K tokens -- the scope may need to be reduced
- If Gmail fetch service is not implemented or is placeholder-only

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test that email cache sync is triggered during onboarding
  - Test that email cache respects duration preference
  - Test that email cache is skipped when no email provider is connected
- Existing tests to update:
  - SyncOrchestratorService tests if adding new sync type

### Coverage

- Coverage impact: Slight increase

### CI Requirements

This task's PR MUST pass:
- [x] Unit tests
- [x] Type checking
- [x] Lint / format checks

## PR Preparation

- **Title**: `feat(onboarding): add initial email cache creation during onboarding`
- **Labels**: `feature`, `onboarding`, `sync`
- **Depends on**: TASK-2083
- **Base**: `develop`

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~20K-25K (service category, moderate complexity)

**Token Cap:** 100K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 3-5 files | +8K |
| Code volume | ~60 lines added | +5K |
| Investigation | Need to explore email fetch infrastructure | +8K |
| Test complexity | Medium | +5K |

**Confidence:** Medium

**Risk factors:**
- Email fetch infrastructure may not support bulk fetch mode -- may need new IPC handler
- Gmail fetch service status unknown -- may be partially implemented
- Could be larger than estimated if new IPC handlers are needed

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*
