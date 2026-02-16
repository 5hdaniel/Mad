# Task TASK-1993: Email Attachment Search -- Server-Side Search, Date Filter, Load More

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

Upgrade the "Attach Emails" modal to perform server-side email search instead of client-side filtering. Add free text search (subject + body + sender), audit period date filtering using the transaction's `started_at`/`closed_at`, and proper "load more" pagination that fetches additional results from the provider.

## Non-Goals

- Do NOT refactor the Gmail or Outlook fetch service `searchEmails()` methods -- they already support `query`, `after`, `before`, `maxResults` parameters
- Do NOT add email body preview display in the modal (body_preview is already returned but showing it is a separate enhancement)
- Do NOT change the email linking/attaching logic (the `link-emails` handler is fine)
- Do NOT add full-text indexing or local caching of emails
- Do NOT change how thread grouping works (`processEmailThreads` stays as-is)

## Deliverables

### 1. Update IPC handler: `electron/transaction-handlers.ts`

The `transactions:get-unlinked-emails` handler currently accepts only `userId`. Update it to accept search parameters:

**Current signature (line ~1392):**
```typescript
ipcMain.handle(
  "transactions:get-unlinked-emails",
  async (event, userId: string): Promise<TransactionResponse> => {
```

**New signature:**
```typescript
ipcMain.handle(
  "transactions:get-unlinked-emails",
  async (
    event: IpcMainInvokeEvent,
    userId: string,
    options?: {
      query?: string;
      after?: string;    // ISO date string
      before?: string;   // ISO date string
      maxResults?: number;
    }
  ): Promise<TransactionResponse> => {
```

**Changes inside the handler:**
- Parse `options.after` and `options.before` into `Date` objects (if provided)
- Pass `query`, `after`, `before`, `maxResults` to both `gmailFetchService.searchEmails()` and `outlookFetchService.searchEmails()`
- Default `maxResults` to 100 if not provided (preserving current behavior)
- Cap `maxResults` at 500 to prevent excessive API usage

**Current code to change (Gmail call, line ~1424):**
```typescript
const gmailEmails = await gmailFetchService.searchEmails({
  maxResults: 100,
});
```

**New:**
```typescript
const gmailEmails = await gmailFetchService.searchEmails({
  query: options?.query || "",
  after: options?.after ? new Date(options.after) : null,
  before: options?.before ? new Date(options.before) : null,
  maxResults: Math.min(options?.maxResults || 100, 500),
});
```

Apply the same pattern for the Outlook call (line ~1450).

### 2. Update preload bridge: `electron/preload/transactionBridge.ts`

**Current (line ~280):**
```typescript
getUnlinkedEmails: (userId: string) =>
  ipcRenderer.invoke("transactions:get-unlinked-emails", userId),
```

**New:**
```typescript
getUnlinkedEmails: (
  userId: string,
  options?: {
    query?: string;
    after?: string;
    before?: string;
    maxResults?: number;
  }
) =>
  ipcRenderer.invoke("transactions:get-unlinked-emails", userId, options),
```

### 3. Update frontend: `src/components/transactionDetailsModule/components/modals/AttachEmailsModal.tsx`

This is the largest change. The modal needs to shift from "fetch all on mount, filter client-side" to "fetch on demand with server-side params."

#### 3a. Add props for audit period dates

Update `AttachEmailsModalProps`:
```typescript
interface AttachEmailsModalProps {
  userId: string;
  transactionId: string;
  propertyAddress?: string;
  /** Audit period start date (ISO string) for date filtering */
  auditStartDate?: string;
  /** Audit period end date (ISO string) for date filtering */
  auditEndDate?: string;
  onClose: () => void;
  onAttached: () => void;
}
```

Check the parent component that renders `AttachEmailsModal` to see if `started_at` and `closed_at` are available. If they are, pass them through. If not, the date filter will still work via manual date entry.

#### 3b. Replace client-side search with server-side search

**Remove** the client-side `filteredThreads` that filters on `searchQuery`. Instead:

1. Add a **debounced search** that calls `getUnlinkedEmails(userId, { query, after, before, maxResults })` when the user types or changes date filters
2. Use `useState` for `searchQuery` (the text input) and a separate `debouncedQuery` that triggers the actual fetch
3. Add a debounce delay of 500ms on the search input to avoid hammering the API on every keystroke
4. Show a loading spinner during search

**Debounce pattern (no external deps needed):**
```typescript
const [debouncedQuery, setDebouncedQuery] = useState("");

useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedQuery(searchQuery);
  }, 500);
  return () => clearTimeout(timer);
}, [searchQuery]);
```

#### 3c. Add audit period date filter UI

Add a date filter section below the search bar:

```tsx
{/* Date Filter */}
<div className="flex items-center gap-3 mt-3">
  <label className="text-sm text-gray-600 whitespace-nowrap">Date range:</label>
  <input
    type="date"
    value={afterDate}
    onChange={(e) => setAfterDate(e.target.value)}
    className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
  />
  <span className="text-gray-400">to</span>
  <input
    type="date"
    value={beforeDate}
    onChange={(e) => setBeforeDate(e.target.value)}
    className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
  />
  {(auditStartDate || auditEndDate) && (
    <button
      onClick={() => {
        setAfterDate(auditStartDate ? auditStartDate.split('T')[0] : '');
        setBeforeDate(auditEndDate ? auditEndDate.split('T')[0] : '');
      }}
      className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
    >
      Audit Period
    </button>
  )}
</div>
```

Pre-populate the date fields with `auditStartDate`/`auditEndDate` if provided. Add a quick "Audit Period" button that fills in the transaction's date range.

#### 3d. Rework "load more" to fetch from provider

Currently `handleLoadMore` just increases `displayCount` to show more locally-held results. Change it to:

1. Keep the existing client-side `displayCount` pagination for rendering (prevents UI freeze)
2. When the user clicks "Load More" AND all fetched results are already displayed, trigger a new fetch with `maxResults` increased (e.g., fetch 200, then 300, etc.)
3. Append new results to existing results (avoiding duplicates by ID)

**State additions:**
```typescript
const [fetchedMaxResults, setFetchedMaxResults] = useState(100);
const [hasMoreFromProvider, setHasMoreFromProvider] = useState(true);
```

When a fetch returns fewer results than `maxResults`, set `hasMoreFromProvider = false`.

#### 3e. Update the search placeholder

Change from:
```
"Search by subject or sender..."
```
To:
```
"Search emails..."
```

(Since server-side search covers subject, body, and sender.)

#### 3f. Update the loading/empty states

- During a search (after initial load), show a subtle loading indicator (e.g., spinner in the search bar) rather than replacing the entire list with a loading screen
- Update the empty state message for search: "No emails matching your search" instead of "No unlinked emails available"

## Acceptance Criteria

- [ ] Typing in the search box triggers a server-side search after 500ms debounce
- [ ] Search queries match email subject, body, and sender (server-side via provider API)
- [ ] Date filter inputs narrow results to a date range
- [ ] "Audit Period" quick-fill button populates date filter from transaction dates (when available)
- [ ] "Load More" fetches additional results from the provider when local results are exhausted
- [ ] Initial load (no search query) still works as before (fetches recent 100 emails)
- [ ] Works for both Gmail and Outlook providers
- [ ] Search input has visual feedback during loading (spinner or similar)
- [ ] maxResults capped at 500 on the backend to prevent excessive API calls
- [ ] All CI checks pass (`npm run type-check`, `npm run lint`, `npm test`)

## Implementation Notes

### Backend Services Already Support Everything

**Gmail** (`electron/services/gmailFetchService.ts` line 195):
```typescript
async searchEmails({
  query = "",
  after = null,
  before = null,
  maxResults = 100,
  onProgress,
}: EmailSearchOptions = {}): Promise<ParsedEmail[]>
```

**Outlook** (`electron/services/outlookFetchService.ts` line 347):
```typescript
async searchEmails({
  query = "",
  after = null,
  before = null,
  maxResults,
  contactEmails,
  onProgress,
}: EmailSearchOptions = {}): Promise<ParsedEmail[]>
```

Both services build provider-specific query strings internally. Gmail uses `q` parameter with Gmail search syntax. Outlook uses OData `$filter` and `$search`. The handler just needs to pass the raw query string through.

### Parent Component

Find where `AttachEmailsModal` is rendered to determine if transaction dates are already available as props. Search for `<AttachEmailsModal` in the codebase. You will likely need to pass `started_at` and `closed_at` from the transaction object.

### Thread Processing Stays Client-Side

The `processEmailThreads()` function and thread-based display remain unchanged. Server-side search returns flat email results; the modal groups them into threads client-side as it does today.

## Integration Notes

- Imports from: No new external dependencies
- Exports to: N/A
- Used by: Transaction detail view (Attach Emails button)
- Depends on: None (first task in sprint)

## Do / Don't

### Do:
- Preserve backward compatibility: `getUnlinkedEmails(userId)` with no options should work exactly as before
- Use `setTimeout`/`clearTimeout` for debounce (no external debounce library)
- Cap maxResults at 500 on the backend
- Handle `null`/`undefined` dates gracefully
- Pre-populate date filter from transaction dates if available
- Show loading state during search without clearing existing results

### Don't:
- Don't modify `gmailFetchService.ts` or `outlookFetchService.ts`
- Don't add new IPC channels -- reuse `transactions:get-unlinked-emails`
- Don't add lodash or other external dependencies for debounce
- Don't remove the existing client-side thread pagination (THREADS_PER_PAGE / displayCount)
- Don't change thread grouping logic
- Don't add email body preview display (that's a separate enhancement)

## When to Stop and Ask

- If `AttachEmailsModal` has been significantly refactored since the described state
- If the parent component does not have access to transaction dates and wiring them through requires changes to more than 2 files
- If `gmailFetchService.searchEmails()` or `outlookFetchService.searchEmails()` signatures have changed from what is documented here
- If the `transactionBridge.ts` has been restructured (e.g., moved to a different pattern)

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test that `getUnlinkedEmails` bridge method passes options through
  - Test that debounced search triggers re-fetch with query param
  - Test that date filter values are passed to the fetch call
  - Test empty/loading/error states during search
- Existing tests to update:
  - If `AttachEmailsModal` has existing tests, ensure they still pass with the new optional props

### Coverage

- Coverage impact: Must not decrease

### Integration / Feature Tests

- Required scenarios: N/A (unit tests + manual testing sufficient)

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(emails): add server-side search, date filter, and load more to Attach Emails modal`
- **Labels**: `feature`, `email`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `feature` (cross-layer wiring: handler + bridge + UI)

**Estimated Tokens:** ~30K

**Token Cap:** 120K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 3 files (handler, bridge, modal) + parent component for date props | +10K |
| Code volume | ~100-150 lines added/modified across all files | +8K |
| Test complexity | Medium (mocking IPC, testing debounce) | +7K |
| Debounce implementation | Simple setTimeout pattern, no library | +3K |
| Date filter UI | Standard HTML date inputs | +2K |

**Confidence:** Medium-High

**Risk factors:**
- Parent component prop threading may touch more files than expected
- Debounce + async fetch interaction can be tricky to test

**Similar past tasks:** BACKLOG-504 (email thread display, estimated ~20K)

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
Files created:
- [ ] N/A

Files modified:
- [ ] electron/transaction-handlers.ts (get-unlinked-emails handler)
- [ ] electron/preload/transactionBridge.ts (getUnlinkedEmails method)
- [ ] src/components/transactionDetailsModule/components/modals/AttachEmailsModal.tsx
- [ ] Parent component that renders AttachEmailsModal (pass date props)

Features implemented:
- [ ] IPC handler accepts query/after/before/maxResults options
- [ ] Bridge passes options through to IPC
- [ ] Search input triggers server-side search with 500ms debounce
- [ ] Date filter inputs with "Audit Period" quick-fill
- [ ] Load more fetches additional results from provider
- [ ] Loading state during search
- [ ] maxResults capped at 500

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

**Variance:** PM Est ~30K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~30K | ~XK | +/-X% |
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
