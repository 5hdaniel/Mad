# Task TASK-1974: Auto-Detect Audit Start Date from Client Communications

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

Add an "Auto / Manual" toggle for the audit start date in Step 1 of the "Audit New Transaction" wizard. When set to "Auto" (the default), the system queries the database for the earliest message or email sent to/received from any of the contacts selected for this transaction, and pre-fills the start date with that date. When set to "Manual", the current date picker behavior is preserved.

## Non-Goals

- Do NOT change how `closed_at` or `closing_deadline` dates work
- Do NOT modify the contact assignment steps (Steps 2 and 3)
- Do NOT add auto-detection for existing/edit transactions (only for new transaction creation)
- Do NOT modify the database schema -- this feature uses existing data with new queries
- Do NOT change the auto-link service or how communications are linked to transactions

## Deliverables

1. **New IPC handler**: `transactions:getEarliestCommunicationDate` -- queries for earliest message/email date among given contact IDs
2. **New backend function**: In `transactionService.ts` or a new utility -- the SQL query logic
3. **Update**: `src/hooks/useAuditTransaction.ts` -- add auto-detect state, toggle logic, and IPC call
4. **Update**: `src/components/audit/AddressVerificationStep.tsx` -- add Auto/Manual toggle UI next to start date
5. **Update**: `src/window.d.ts` -- add type for new IPC call
6. **Update**: `electron/preload/transactionBridge.ts` -- expose new IPC call
7. **Update**: `electron/transaction-handlers.ts` -- register new handler
8. **New test**: Test for the new IPC handler / query logic
9. **Update test**: `AddressVerificationStep` test if one exists, or `AuditTransactionModal` test

## Acceptance Criteria

- [ ] New transaction wizard shows an "Auto / Manual" toggle next to the "Representation Start Date" field
- [ ] Default mode is "Auto" -- the system attempts to find the earliest communication date
- [ ] In "Auto" mode, when contacts are selected (Step 2/3), going back to Step 1 or on initial load, the start date is auto-filled with the earliest communication date
- [ ] If no communications are found for the selected contacts, "Auto" mode falls back to the current default (1 year ago) and shows a hint message
- [ ] In "Manual" mode, the date picker works exactly as it does today (user picks the date)
- [ ] Switching from Auto to Manual preserves the current date value (user can fine-tune the auto-detected date)
- [ ] Switching from Manual to Auto re-triggers the auto-detection query
- [ ] The auto-detection query considers BOTH messages (SMS/iMessage) and emails across ALL selected contacts
- [ ] All CI checks pass (type-check, lint, tests)
- [ ] PR created targeting `develop`

## Implementation Notes

### Codebase Architecture Overview (from PM Investigation)

#### Audit Wizard Flow (3-Step)
- **Step 1** (`AddressVerificationStep.tsx`): Address, transaction type, dates (started_at, closing_deadline, closed_at)
- **Step 2** (`ContactAssignmentStep.tsx`): Select contacts
- **Step 3** (`ContactAssignmentStep.tsx`): Assign roles to contacts
- State managed in `useAuditTransaction.ts` hook

#### Current Start Date Behavior
- Default: 1 year ago from today (`getDefaultStartDate()` in `useAuditTransaction.ts` line 131-135)
- User can override with date picker in `AddressVerificationStep.tsx` (line 121-133)
- The `addressData.started_at` state holds the value as `YYYY-MM-DD` string

#### Database Tables for Communications

**Messages table** (SMS/iMessage):
- `messages.sent_at` -- when the message was sent
- `messages.user_id` -- owner
- `messages.participants_flat` -- denormalized phone numbers
- `messages.channel` -- 'sms' | 'imessage'
- Contacts link via `contact_phones.phone_e164` matched against `messages.participants_flat`

**Emails table** (Gmail/Outlook):
- `emails.sent_at` -- when the email was sent
- `emails.user_id` -- owner
- `emails.sender` -- from address
- `emails.recipients` -- to addresses
- Contacts link via `contact_emails.email` matched against `emails.sender`/`emails.recipients`

**Contact linking**:
- `contact_emails` table: `contact_id -> email`
- `contact_phones` table: `contact_id -> phone_e164`

#### SQL Query Strategy

The auto-detect query should find the earliest `sent_at` across both messages and emails for given contact IDs:

```sql
-- For a set of contact IDs, find the earliest communication date
-- Step 1: Get emails and phones for the contacts
-- Step 2: Find earliest email sent_at matching those email addresses
-- Step 3: Find earliest message sent_at matching those phone numbers
-- Step 4: Return the MIN of both

WITH contact_info AS (
  SELECT
    ce.email,
    cp.phone_e164
  FROM contacts c
  LEFT JOIN contact_emails ce ON ce.contact_id = c.id
  LEFT JOIN contact_phones cp ON cp.contact_id = c.id
  WHERE c.id IN (?, ?, ...)  -- contact IDs
),
earliest_email AS (
  SELECT MIN(e.sent_at) as earliest
  FROM emails e
  WHERE e.user_id = ?
    AND EXISTS (
      SELECT 1 FROM contact_info ci
      WHERE LOWER(e.sender) LIKE '%' || LOWER(ci.email) || '%'
         OR LOWER(e.recipients) LIKE '%' || LOWER(ci.email) || '%'
    )
    AND e.sent_at IS NOT NULL
),
earliest_message AS (
  SELECT MIN(m.sent_at) as earliest
  FROM messages m
  WHERE m.user_id = ?
    AND m.channel IN ('sms', 'imessage')
    AND m.duplicate_of IS NULL
    AND EXISTS (
      SELECT 1 FROM contact_info ci
      WHERE ci.phone_e164 IS NOT NULL
        AND m.participants_flat LIKE '%' || REPLACE(REPLACE(REPLACE(ci.phone_e164, '+', ''), '-', ''), ' ', '') || '%'
    )
    AND m.sent_at IS NOT NULL
)
SELECT MIN(earliest) as earliest_date
FROM (
  SELECT earliest FROM earliest_email
  UNION ALL
  SELECT earliest FROM earliest_message
);
```

**Note:** The phone matching uses `participants_flat` which contains normalized phone digits. Use the `normalizePhone` pattern from `autoLinkService.ts` for consistency.

**Simpler approach (recommended):** Two separate simple queries may perform better than a complex CTE:

```typescript
// Query 1: Earliest email
const earliestEmail = dbGet(`
  SELECT MIN(e.sent_at) as earliest
  FROM emails e
  INNER JOIN contact_emails ce ON LOWER(e.sender) LIKE '%' || LOWER(ce.email) || '%'
     OR LOWER(e.recipients) LIKE '%' || LOWER(ce.email) || '%'
  WHERE e.user_id = ?
    AND ce.contact_id IN (${placeholders})
    AND e.sent_at IS NOT NULL
`, [userId, ...contactIds]);

// Query 2: Earliest message
const earliestMessage = dbGet(`
  SELECT MIN(m.sent_at) as earliest
  FROM messages m
  INNER JOIN contact_phones cp ON m.participants_flat LIKE '%' || REPLACE(REPLACE(cp.phone_e164, '+', ''), '-', '') || '%'
  WHERE m.user_id = ?
    AND cp.contact_id IN (${placeholders})
    AND m.channel IN ('sms', 'imessage')
    AND m.duplicate_of IS NULL
    AND m.sent_at IS NOT NULL
`, [userId, ...contactIds]);

// Take the earlier of the two
```

#### IPC Pattern (follow existing patterns)

**Handler registration** (`electron/transaction-handlers.ts`):
```typescript
ipcMain.handle(
  "transactions:get-earliest-communication-date",
  async (event, contactIds: string[], userId: string) => {
    try {
      validateUserId(userId);
      // ... call service
      return { success: true, date: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);
```

**Preload bridge** (`electron/preload/transactionBridge.ts`):
```typescript
getEarliestCommunicationDate: (contactIds: string[], userId: string) =>
  ipcRenderer.invoke("transactions:get-earliest-communication-date", contactIds, userId),
```

**Window type** (`src/window.d.ts` in `transactions` section):
```typescript
getEarliestCommunicationDate: (contactIds: string[], userId: string) => Promise<{
  success: boolean;
  date?: string;  // ISO date string or null
  error?: string;
}>;
```

#### UI Component Changes

**AddressVerificationStep.tsx** -- Add toggle above the start date input:

```tsx
// New props needed
interface AddressVerificationStepProps {
  // ... existing props ...
  startDateMode: "auto" | "manual";
  onStartDateModeChange: (mode: "auto" | "manual") => void;
  autoDetectedDate?: string | null;  // null = no communications found
  isAutoDetecting?: boolean;  // loading state
}

// Toggle UI (above the date input)
<div className="flex items-center gap-2 mb-2">
  <button
    onClick={() => onStartDateModeChange("auto")}
    className={`px-3 py-1 rounded-md text-sm font-medium ${
      startDateMode === "auto" ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-700"
    }`}
  >
    Auto
  </button>
  <button
    onClick={() => onStartDateModeChange("manual")}
    className={`px-3 py-1 rounded-md text-sm font-medium ${
      startDateMode === "manual" ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-700"
    }`}
  >
    Manual
  </button>
</div>
// If auto mode and detecting, show spinner
// If auto mode and date found, show the date picker disabled with the auto-detected value
// If auto mode and no date found, show fallback message
// If manual mode, show normal date picker
```

#### Hook Changes (`useAuditTransaction.ts`)

Add state:
```typescript
const [startDateMode, setStartDateMode] = useState<"auto" | "manual">("auto");
const [autoDetectedDate, setAutoDetectedDate] = useState<string | null>(null);
const [isAutoDetecting, setIsAutoDetecting] = useState(false);
```

Add auto-detect function:
```typescript
const detectStartDate = useCallback(async (contactIds: string[]) => {
  if (contactIds.length === 0) return;
  setIsAutoDetecting(true);
  try {
    const result = await window.api.transactions.getEarliestCommunicationDate(contactIds, userId);
    if (result.success && result.date) {
      const dateStr = result.date.split("T")[0]; // YYYY-MM-DD
      setAutoDetectedDate(dateStr);
      if (startDateMode === "auto") {
        setAddressData(prev => ({ ...prev, started_at: dateStr }));
      }
    } else {
      setAutoDetectedDate(null);
      // Keep default (1 year ago) if no communications found
    }
  } catch {
    setAutoDetectedDate(null);
  } finally {
    setIsAutoDetecting(false);
  }
}, [userId, startDateMode]);
```

**IMPORTANT timing consideration:** The auto-detect should run after Step 2 (contact selection), not Step 1. The user selects contacts in Step 2, then the detected date can be applied. Two approaches:

**Approach A (Recommended):** Run auto-detect when user navigates back from Step 2 to Step 1, or when Step 1 is first shown IF contacts are already selected (edit mode / going back).

**Approach B:** Run auto-detect in Step 2 in the background, and when user goes back to Step 1, the date is already available.

**For new transactions (typical flow):** Step 1 -> Step 2 (select contacts) -> Step 3 (assign roles). The user typically fills Step 1 BEFORE selecting contacts. So the auto-detect naturally runs when:
1. User opens modal, Step 1 shown -- no contacts selected yet, use default
2. User goes to Step 2, selects contacts
3. User goes to Step 3, assigns roles
4. At Step 3 submit / or if user goes back to Step 1, auto-detect fires with selected contacts

**Simplest implementation:** Trigger auto-detect whenever `selectedContactIds` changes AND `startDateMode === "auto"`. If the user is on Step 1 when this happens (e.g., they went back), the date updates live. If they're on Step 2/3, the date is ready when they go back.

## Integration Notes

- **Depends on**: TASK-1973 (PR #815, branch `fix/TASK-1973-audit-date-save`) -- must include the date-saving fix
- **Branch from**: `fix/TASK-1973-audit-date-save` (NOT develop)
- **PR targets**: `develop`
- Imports from: `electron/services/db/core/dbConnection.ts` (dbGet, dbAll)
- Uses: `contact_emails`, `contact_phones`, `emails`, `messages` tables
- Pattern reference: `electron/services/autoLinkService.ts` (similar contact-based queries)

## Do / Don't

### Do:

- Follow existing IPC patterns exactly (handler + bridge + window type)
- Use `dbGet`/`dbAll` from `electron/services/db/core/dbConnection.ts` for queries
- Normalize phone numbers the same way as `autoLinkService.ts` (strip non-digits)
- Keep the Auto/Manual toggle visually consistent with existing button toggles (like Purchase/Sale)
- Show a helpful message when auto-detect finds no communications
- Handle the case where contacts have no emails AND no phone numbers gracefully

### Don't:

- Don't block Step 1 rendering while auto-detecting -- show a spinner inline
- Don't require contacts to be selected for Step 1 to work (Auto mode just uses default if no contacts yet)
- Don't modify the database schema
- Don't change how `handleCreateTransaction` works -- it already correctly uses `addressData.started_at`
- Don't break the edit mode flow (edit mode should continue to work as-is, no auto-detect needed)

## When to Stop and Ask

- If the query performance is poor (>500ms) on a large database, ask about optimization
- If the `participants_flat` phone matching pattern doesn't work reliably, ask about alternatives
- If there's confusion about whether to include the user's own email in the query (exclude it, like autoLinkService does)
- If type conflicts arise with the window.d.ts changes

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test the backend query function: given contact IDs with known messages/emails, returns the correct earliest date
  - Test the case where no communications exist (returns null)
  - Test with contacts that have emails but no phones, and vice versa
- Existing tests to update:
  - `AddressVerificationStep` test (if exists) or `AuditTransactionModal.test.tsx` to cover the toggle

### Coverage

- Coverage impact: Should not decrease -- new code comes with new tests

### Integration / Feature Tests

- Not required for this task (IPC handlers are tested via unit tests)

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(audit): auto-detect start date from client communications`
- **Base branch**: `develop`
- **Labels**: `feature`, `audit`
- **Depends on**: TASK-1973 (PR #815)

---

## PM Estimate (PM-Owned)

**Category:** `ipc + ui + service`

**Estimated Tokens:** ~30K-50K

**Token Cap:** 200K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0 new files (logic added to existing) | - |
| Files to modify | 7 files (hook, component, handler, bridge, window.d.ts, service, tests) | +25K |
| Code volume | ~200 lines new code | +15K |
| Test complexity | Medium (need to mock IPC, test query logic) | +10K |

**Confidence:** Medium

**Risk factors:**
- Phone number matching in SQL may need tuning
- Auto-detect timing with the step navigation could be tricky
- Integration with existing date state management

**Similar past tasks:** TASK-1031 (auto-link service, similar contact-based queries, actual: ~25K tokens)

---

## Branch Information

- **Branch From:** `fix/TASK-1973-audit-date-save` (PR #815)
- **Branch Into:** `develop`
- **Branch Name:** `feature/TASK-1974-auto-detect-start-date`
- **Worktree Path:** `/Users/daniel/Documents/Mad-auto-start-date`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files modified:
- [ ] electron/transaction-handlers.ts (new IPC handler)
- [ ] electron/preload/transactionBridge.ts (expose IPC)
- [ ] electron/services/transactionService.ts (query logic)
- [ ] src/window.d.ts (new type)
- [ ] src/hooks/useAuditTransaction.ts (auto-detect state + logic)
- [ ] src/components/audit/AddressVerificationStep.tsx (toggle UI)
- [ ] Tests

Features implemented:
- [ ] Auto/Manual toggle in Step 1
- [ ] Backend query for earliest communication date
- [ ] IPC round-trip working
- [ ] Auto-detect triggers on contact selection

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~30K-50K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If you deviated from the approved plan, explain what and why. Use "DEVIATION:" prefix.>
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

**REQUIRED: Compare PM token estimate to actual to improve future predictions.**

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~30K-50K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

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
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

**A task is NOT complete until the PR is MERGED (not just approved).**

```bash
# Verify merge state
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
