# Task TASK-1950: Wire Direct Contact Imports to Preferences

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

Make the three direct contact import sources (Outlook Contacts, Gmail/macOS Contacts, macOS/iPhone Contacts) respect the `contactSources.direct.*` preference toggles added in TASK-1949. When a source is disabled, its import should be silently skipped.

## Non-Goals

- Do NOT modify the Settings UI (TASK-1949 handles that)
- Do NOT modify inferred/auto-discovered contact extraction (TASK-1951)
- Do NOT modify message import filtering (TASK-1952)
- Do NOT change the contact data model or schema
- Do NOT add new database tables

## Deliverables

1. Update: `electron/contact-handlers.ts` -- check preferences before macOS Contacts sync and Outlook contact sync
2. Update: `electron/services/iPhoneSyncStorageService.ts` -- check preferences before storing iPhone-synced contacts
3. Possibly update: `electron/services/db/externalContactDbService.ts` -- if a source-level filter is needed

## Acceptance Criteria

- [ ] When `contactSources.direct.outlookContacts` is false, `contacts:syncOutlookContacts` IPC handler returns early with success (no sync)
- [ ] When `contactSources.direct.macosContacts` is false, `contacts:syncExternal` IPC handler returns early with success (no sync)
- [ ] When `contactSources.direct.macosContacts` is false, `contacts:get-available` skips the external_contacts shadow table step
- [ ] When `contactSources.direct.gmailContacts` is false, Gmail contacts are skipped (if/when Gmail contacts import is added; currently not implemented -- add a preference check placeholder)
- [ ] iPhone sync contact storage respects `contactSources.direct.macosContacts` preference
- [ ] Default behavior (no preferences set) is unchanged -- all sources enabled
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] All CI checks pass

## Implementation Notes

### Reading Preferences from Electron Main Process

The preference handlers use `supabaseService.getPreferences(userId)` to load preferences. In the Electron main process, read the preference at the start of each relevant handler:

```typescript
import supabaseService from "./services/supabaseService";

// Helper to check if a contact source is enabled
async function isContactSourceEnabled(
  userId: string,
  category: 'direct' | 'inferred',
  key: string,
  defaultValue: boolean = true
): Promise<boolean> {
  try {
    const preferences = await supabaseService.getPreferences(userId);
    const value = preferences?.contactSources?.[category]?.[key];
    return typeof value === 'boolean' ? value : defaultValue;
  } catch {
    return defaultValue; // Fail open - don't break imports if preferences unavailable
  }
}
```

**Important:** Place this helper in a shared location like `electron/utils/preferenceHelper.ts` so TASK-1951 can reuse it.

### Gate Points

**1. Outlook Contacts Sync** (`electron/contact-handlers.ts`, `contacts:syncOutlookContacts` handler, ~line 1401)

Add at the start of the handler, after userId validation:

```typescript
// Check if Outlook contacts source is enabled
const outlookEnabled = await isContactSourceEnabled(validatedUserId, 'direct', 'outlookContacts', true);
if (!outlookEnabled) {
  logService.info("[Main] Outlook contacts sync skipped (disabled in preferences)", "Contacts", { userId: validatedUserId });
  return { success: true, count: 0 };
}
```

**2. macOS Contacts Sync** (`electron/contact-handlers.ts`, `contacts:syncExternal` handler, ~line 1288)

Add at the start of the handler, after userId validation:

```typescript
// Check if macOS contacts source is enabled
const macosEnabled = await isContactSourceEnabled(validatedUserId, 'direct', 'macosContacts', true);
if (!macosEnabled) {
  logService.info("[Main] macOS contacts sync skipped (disabled in preferences)", "Contacts", { userId: validatedUserId });
  return { success: true, inserted: 0, deleted: 0, total: 0 };
}
```

**3. Available Contacts** (`electron/contact-handlers.ts`, `contacts:get-available` handler, ~line 169)

The `contacts:get-available` handler has two sources: iPhone-synced DB contacts (Step 1) and external_contacts shadow table (Steps 2-3). Gate each based on the macOS contacts preference:

```typescript
// Only include external macOS contacts if source is enabled
const macosEnabled = await isContactSourceEnabled(validatedUserId, 'direct', 'macosContacts', true);
// ... Step 1 (iPhone DB contacts) should also check this
// ... Steps 2-3 (shadow table) should also check this
```

For Outlook contacts in the shadow table, also check `outlookContacts`:
```typescript
const outlookEnabled = await isContactSourceEnabled(validatedUserId, 'direct', 'outlookContacts', true);
// When filtering external contacts, skip source="outlook" if outlookEnabled is false
```

**4. iPhone Sync Storage** (`electron/services/iPhoneSyncStorageService.ts`)

The `persistContacts` method stores contacts from iPhone sync. Add a preference check:

```typescript
// Check if macOS/iPhone contacts source is enabled
const macosEnabled = await isContactSourceEnabled(userId, 'direct', 'macosContacts', true);
if (!macosEnabled) {
  return { contactsStored: 0, contactsSkipped: contacts.length };
}
```

### Fail-Open Strategy

If preferences cannot be loaded (Supabase offline, network error), default to enabled (true). This ensures the app doesn't break silently. Log warnings when preferences can't be loaded.

## Integration Notes

- Depends on: TASK-1949 (preferences schema must exist)
- Creates: `electron/utils/preferenceHelper.ts` (shared helper for TASK-1951)
- TASK-1951 will reuse the `isContactSourceEnabled` helper for the `inferred` category
- Does NOT conflict with TASK-1951 or TASK-1952 (different files)

## Do / Don't

### Do:

- Fail open (default to enabled) if preferences unavailable
- Log clearly when a source is skipped due to preferences
- Return success (not error) when a source is disabled -- user chose to disable it
- Create the shared helper in `electron/utils/preferenceHelper.ts`

### Don't:

- Do NOT show errors to the user when a source is disabled
- Do NOT modify the UI or Settings component
- Do NOT change the preferences:update handler
- Do NOT add new database columns or tables
- Do NOT break existing import flows when preferences are unset

## When to Stop and Ask

- If `supabaseService.getPreferences` is not accessible from the handlers
- If the iPhone sync storage path is different than documented
- If you discover Gmail contacts are already being imported somewhere (they should not be currently)

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `isContactSourceEnabled` helper: test with various preference shapes (missing key, false, true, undefined)
- Existing tests to update:
  - If contact handler tests exist, add a test case for disabled source skipping

### Coverage

- Coverage impact: Must not decrease

### Integration / Feature Tests

- Required scenarios:
  - Disable Outlook contacts in prefs, call `contacts:syncOutlookContacts` -- verify it returns early
  - Disable macOS contacts in prefs, call `contacts:syncExternal` -- verify it returns early
  - No preferences set -- verify default behavior unchanged

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(contacts): wire direct contact imports to source preferences`
- **Labels**: `feature`, `contacts`, `preferences`
- **Depends on**: TASK-1949 (preferences schema)

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~20K-25K

**Token Cap:** 100K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 1 new file (preferenceHelper.ts) | +5K |
| Files to modify | 2 files (contact-handlers.ts, iPhoneSyncStorageService.ts) | +10K |
| Code volume | ~50 lines helper + ~30 lines per gate point (4 gates) | +5K |
| Test complexity | Low-Medium (helper tests + handler mock tests) | +5K |

**Confidence:** Medium-High

**Risk factors:**
- Supabase preferences access from main process context (already used in transactionService.ts)
- iPhone sync storage may have a different async pattern

**Similar past tasks:** Service category, apply 0.5x multiplier -> ~12.5K effective

---

## Implementation Summary (Engineer-Owned)

*Completed: 2026-02-10*

### Agent ID

```
Engineer Agent ID: opus-4.6-engineer-task-1950
```

### Checklist

```
Files created:
- [x] electron/utils/preferenceHelper.ts
- [x] electron/utils/__tests__/preferenceHelper.test.ts

Files modified:
- [x] electron/contact-handlers.ts
- [x] electron/services/iPhoneSyncStorageService.ts
- [x] electron/__tests__/contact-handlers.test.ts

Features implemented:
- [x] Shared isContactSourceEnabled helper
- [x] Outlook contacts sync gate
- [x] macOS contacts sync gate
- [x] Available contacts filtering by source (both macOS and Outlook per-source)
- [x] iPhone sync storage gate

Verification:
- [x] npm run type-check passes
- [x] npm run lint passes
- [x] npm test passes (13 preferenceHelper tests + 49 contact-handler tests)
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "opus-4.6-engineer-task-1950" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | TBD (auto-captured) |
| Duration | TBD |
| API Calls | TBD |
| Input Tokens | TBD |
| Output Tokens | TBD |
| Cache Read | TBD |
| Cache Create | TBD |

### Notes

**Planning notes:**
- Used supabaseService.getPreferences() which is already proven in transactionService.ts
- Fail-open strategy ensures no breakage if Supabase is offline
- contacts:get-available handler needs per-source filtering since external_contacts table stores both macOS and Outlook contacts with a source field

**Deviations from plan:**
- Task file mentioned updating MacOSContactsImportSettings.tsx UI -- skipped per non-goal ("Do NOT modify the Settings UI")
- Added test file for preferenceHelper (not just handler tests)
- The contacts:get-available handler gates the macOS shadow table sync (Steps 2) only when macosEnabled, and filters individual contacts in Step 3 by their specific source (outlook vs contacts_app)

**Design decisions:**
- In contacts:get-available, Step 2 (shadow table sync from macOS API) is gated entirely by macosContacts preference since it only syncs macOS contacts
- In Step 3, individual external contacts are filtered per-source: Outlook contacts skipped when outlookEnabled=false, non-Outlook contacts skipped when macosEnabled=false
- The preference helper is in electron/utils/ alongside other helpers, with the __tests__ directory pattern matching existing utils tests

**Issues encountered:**
None - implementation was straightforward.

**Reviewer notes:**
- The contacts:get-available handler now checks two preferences (macosContacts and outlookContacts) at the top, then uses them at three gate points (Step 1, Step 2 sync, Step 3 filtering)
- Pre-existing test failures in tests/e2e/autoDetection.test.tsx (useLicense provider context) are unrelated to this PR

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~25K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<Explanation>

**Suggestion for similar tasks:**
<Recommendation>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

```bash
gh pr view <PR-NUMBER> --json state --jq '.state'
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
