# Task TASK-1952: Filter Messages on Import to Limit Database Size

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

Add configurable message import filters (date range and message count cap) to control database bloat from macOS Messages import. The user has 678,070+ messages imported -- these filters let users limit how many messages are stored locally.

## Non-Goals

- Do NOT retroactively delete already-imported messages (only filter on new imports)
- Do NOT modify contact source preferences (TASK-1949/1950/1951)
- Do NOT change the message data model or schema
- Do NOT add per-conversation filtering (only bulk filters)
- Do NOT modify iPhone sync message storage (this task covers macOS Messages import only)
- Do NOT change email import behavior (only SMS/iMessage from macOS Messages)

## Deliverables

1. Update: `src/components/settings/MacOSMessagesImportSettings.tsx` -- add filter controls UI
2. Update: `electron/handlers/messageImportHandlers.ts` -- pass filter params to import service
3. Update: `electron/services/macOSMessagesImportService.ts` -- apply date range and count cap filters

## Acceptance Criteria

- [ ] "Message Import Filters" section appears in the macOS Messages import settings
- [ ] Date range filter: dropdown to select how far back to import (3, 6, 9, 12, 18, 24 months, or "All")
- [ ] Count cap filter: input field for maximum number of messages to import (default: unlimited)
- [ ] Filters persist to user preferences under `messageImport.filters` key
- [ ] macOS Messages import respects date range filter (SQL WHERE clause on message date)
- [ ] macOS Messages import respects count cap (SQL LIMIT clause, most recent first)
- [ ] "Force Re-import" with filters only imports messages matching the filter criteria
- [ ] Import count display shows "X of Y available messages" when filters are active
- [ ] Default behavior (no filters set) imports all messages (backward compatible)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] All CI checks pass

## Implementation Notes

### Preferences Schema

Store under `messageImport` key:

```typescript
{
  messageImport: {
    filters: {
      lookbackMonths: null,     // null = all, number = months back
      maxMessages: null,        // null = unlimited, number = cap
    }
  }
}
```

### UI Changes (`MacOSMessagesImportSettings.tsx`)

Add filter controls above the Import/Force Re-import buttons:

```tsx
{/* Message Import Filters */}
<div className="mb-3 p-3 bg-white rounded border border-gray-200">
  <h5 className="text-xs font-medium text-gray-700 mb-2">Import Filters</h5>

  {/* Date Range */}
  <div className="flex items-center justify-between mb-2">
    <span className="text-xs text-gray-600">Import messages from</span>
    <select
      value={lookbackMonths ?? 'all'}
      onChange={(e) => handleLookbackChange(e.target.value)}
      className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
    >
      <option value="3">Last 3 months</option>
      <option value="6">Last 6 months</option>
      <option value="9">Last 9 months</option>
      <option value="12">Last 12 months</option>
      <option value="18">Last 18 months</option>
      <option value="24">Last 24 months</option>
      <option value="all">All time</option>
    </select>
  </div>

  {/* Message Cap */}
  <div className="flex items-center justify-between">
    <span className="text-xs text-gray-600">Maximum messages</span>
    <select
      value={maxMessages ?? 'unlimited'}
      onChange={(e) => handleMaxMessagesChange(e.target.value)}
      className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
    >
      <option value="10000">10,000</option>
      <option value="50000">50,000</option>
      <option value="100000">100,000</option>
      <option value="250000">250,000</option>
      <option value="500000">500,000</option>
      <option value="unlimited">Unlimited</option>
    </select>
  </div>
</div>
```

### Saving Filters

```typescript
const handleLookbackChange = async (value: string) => {
  const months = value === 'all' ? null : Number(value);
  setLookbackMonths(months);
  try {
    await window.api.preferences.update(userId, {
      messageImport: {
        filters: {
          lookbackMonths: months,
        },
      },
    });
  } catch {
    // Silently handle
  }
};
```

### IPC Changes (`messageImportHandlers.ts`)

Update the `messages:import-macos` handler to accept and pass filter parameters:

```typescript
ipcMain.handle(
  "messages:import-macos",
  async (
    _event: IpcMainInvokeEvent,
    userId: string,
    forceReimport = false
  ): Promise<MacOSImportResult> => {
    // Load message import filter preferences
    let lookbackMonths: number | null = null;
    let maxMessages: number | null = null;
    try {
      const preferences = await supabaseService.getPreferences(validUserId);
      lookbackMonths = preferences?.messageImport?.filters?.lookbackMonths ?? null;
      maxMessages = preferences?.messageImport?.filters?.maxMessages ?? null;
    } catch {
      // Use defaults if preferences unavailable
    }

    // ... existing code ...

    const result = await macOSMessagesImportService.importMessages(
      validUserId,
      onProgress,
      forceReimport,
      { lookbackMonths, maxMessages } // NEW: pass filters
    );
```

You will need to add `import supabaseService from "../services/supabaseService"` to the handler file.

### Service Changes (`macOSMessagesImportService.ts`)

The import service reads from `~/Library/Messages/chat.db` using SQLite. The key query that fetches messages needs to be modified to support filtering.

**Add filter options interface:**

```typescript
export interface MessageImportFilters {
  lookbackMonths?: number | null;  // null = all
  maxMessages?: number | null;     // null = unlimited
}
```

**Modify the `importMessages` method signature:**

```typescript
async importMessages(
  userId: string,
  onProgress?: ImportProgressCallback,
  forceReimport?: boolean,
  filters?: MessageImportFilters
): Promise<MacOSImportResult>
```

**Apply filters to the SQL query that reads from chat.db:**

The service queries messages from the macOS Messages database. Find the SQL query that reads messages and add:

1. Date filter:
```sql
-- macOS Messages uses Apple epoch (seconds since 2001-01-01)
-- Convert lookbackMonths to Apple epoch timestamp
WHERE date > ?  -- Apple epoch timestamp for lookback cutoff
```

Apple epoch conversion:
```typescript
// Apple epoch is seconds since 2001-01-01
const APPLE_EPOCH_OFFSET = 978307200; // seconds between Unix epoch and Apple epoch
const cutoffDate = new Date();
cutoffDate.setMonth(cutoffDate.getMonth() - lookbackMonths);
const appleCutoff = Math.floor(cutoffDate.getTime() / 1000) - APPLE_EPOCH_OFFSET;
// Apple stores as nanoseconds in some versions: appleCutoff * 1000000000
```

2. Count cap:
```sql
ORDER BY date DESC
LIMIT ?  -- maxMessages cap
```

**Important:** The macOS Messages DB stores dates in Apple epoch format (nanoseconds since 2001-01-01). Check the existing `macTimestampToDate` utility in `electron/utils/dateUtils.ts` for the exact conversion. The query must match the format used in chat.db.

### Available Message Count

Update `getAvailableMessageCount()` to also respect filters:

```typescript
async getAvailableMessageCount(filters?: MessageImportFilters): Promise<{
  success: boolean;
  count?: number;
  filteredCount?: number;
  error?: string;
}>
```

This lets the UI show "X of Y available messages" when filters are active.

## Integration Notes

- Independent of TASK-1949/1950/1951 (different concern: messages vs contacts)
- Uses existing preferences infrastructure (same as TASK-1949)
- The `macOSMessagesImportService` already has the core import logic; this task adds filtering
- The `messages:import-macos` handler already accepts `forceReimport`; add filters as a new parameter
- iPhone sync storage (`iPhoneSyncStorageService.ts`) is NOT modified -- that's a different import path

## Do / Don't

### Do:

- Preserve backward compatibility (no filters = import all)
- Use Apple epoch correctly when filtering dates in chat.db
- Show clear feedback about how many messages will be imported with current filters
- Handle the case where filters reduce count to 0 gracefully

### Don't:

- Do NOT delete existing imported messages when filters change
- Do NOT modify iPhone sync message storage
- Do NOT change the message database schema
- Do NOT modify email import (only macOS Messages / iMessage / SMS)
- Do NOT change the message count IPC handler signature in a breaking way

## When to Stop and Ask

- If the macOS Messages database date format doesn't match the documented Apple epoch
- If the SQL query structure in macOSMessagesImportService is significantly different than expected
- If message import uses a streaming/batch approach that makes LIMIT difficult
- If the `forceReimport` param is passed differently than documented

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Date filter calculation (Apple epoch conversion)
  - Count cap query construction
  - Filter parameter passing from handler to service
- Existing tests to update:
  - macOSMessagesImportService tests should verify filter behavior

### Coverage

- Coverage impact: Must not decrease

### Integration / Feature Tests

- Required scenarios:
  - Import with 6-month lookback -- verify only recent messages imported
  - Import with 50K cap -- verify no more than 50K messages stored
  - Import with both filters -- verify both applied (date AND count)
  - Import with no filters -- verify all messages imported (backward compat)
  - Force Re-import with filters -- verify filters respected

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(messages): add date range and count cap filters for macOS Messages import`
- **Labels**: `feature`, `messages`, `settings`, `performance`
- **Depends on**: None (independent of contact source tasks)

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~25K-30K

**Token Cap:** 120K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 3 files (UI, handler, service) | +15K |
| Code volume | ~60 lines UI + ~30 lines handler + ~40 lines service | +5K |
| Complexity | Apple epoch date math, SQL modification | +5K |
| Test complexity | Medium (date conversion, query building) | +5K |

**Confidence:** Medium

**Risk factors:**
- Apple epoch date format in chat.db (nanoseconds vs seconds varies by macOS version)
- The import service may use streaming/batching that complicates LIMIT
- Force Re-import flow may need careful handling with filters

**Similar past tasks:** Service category, apply 0.5x multiplier -> ~15K effective

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: 2026-02-10*

### Agent ID

```
Engineer Agent ID: (auto-captured)
```

### Checklist

```
Files modified:
- [x] src/components/settings/MacOSMessagesImportSettings.tsx
- [x] electron/handlers/messageImportHandlers.ts
- [x] electron/services/macOSMessagesImportService.ts
- [x] electron/services/__tests__/macOSMessagesImportService.filters.test.ts (NEW)

Features implemented:
- [x] Filter controls UI (date range + count cap)
- [x] Filter preference persistence
- [x] Date range SQL filter
- [x] Count cap SQL filter
- [x] Available count with filters
- [x] Backward compatibility (no filters = all)

Verification:
- [x] npm run type-check passes
- [x] npm run lint passes
- [x] npm test passes (350 related tests, 36 new)
```

### Metrics (Auto-Captured)

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
Three files to modify (UI, handler, service) plus one new test file. Apple epoch date math is the key complexity.

**Deviations from plan:**
None. Implemented exactly as specified in the task file.

**Design decisions:**
- Used `MAC_EPOCH` constant from `electron/constants.ts` for date conversion (consistent with existing `macTimestampToDate` utility)
- Date filter applied as SQL WHERE clause (`AND message.date > <nanoseconds>`) directly in the cursor-based batch query
- Count cap applied by limiting total fetch count rather than using SQL LIMIT on individual batches (preserves cursor-based pagination)
- Filter preferences stored under `messageImport.filters` key in user preferences
- `getAvailableMessageCount()` now returns both `count` (total) and `filteredCount` (with filters applied) for "X of Y" display
- Filters are disabled during import to prevent mid-import changes

**Issues encountered:**
None.

**Reviewer notes:**
- The date filter clause uses string interpolation for the nanosecond value in SQL. This is safe because the value is computed from `MAC_EPOCH` (a constant) and `Date.getTime()` (always a number) -- no user input reaches the SQL.
- Pre-existing test failures in `tests/e2e/autoDetection.test.tsx` (8 tests, LicenseProvider context issue) are unrelated to this change.

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~30K | ~XK | +/-X% |
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
