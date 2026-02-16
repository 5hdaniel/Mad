# Task TASK-1991: Contact Source Stats Breakdown in Import Settings

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

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Add per-source contact count statistics to the Contacts Import Settings section (expanded in TASK-1989), showing how many contacts exist per source (macOS, iPhone, Outlook) from the `external_contacts` table.

## Non-Goals

- Do NOT show added/modified/deleted counts per individual sync run (just total counts per source)
- Do NOT add stats for `contacts` table sources (manual, email, sms, etc.) -- only `external_contacts`
- Do NOT modify the database schema
- Do NOT add historical sync tracking
- Do NOT modify the sync orchestrator

## Deliverables

1. New IPC handler: `contacts:getSourceStats` in `electron/contact-handlers.ts`
2. New preload method: Add to `contactBridge.ts`
3. New type declaration: In `src/window.d.ts` and `electron/types/ipc.ts`
4. New DB query: In `electron/services/db/externalContactDbService.ts`
5. Update: `src/components/settings/MacOSContactsImportSettings.tsx` (renamed to `ContactsImportSettings` by TASK-1989)

## Acceptance Criteria

- [ ] A new `getContactSourceStats(userId)` function exists in `externalContactDbService.ts`
- [ ] It returns counts grouped by source: `{ macos: number, iphone: number, outlook: number }`
- [ ] IPC handler registered and callable from renderer
- [ ] Import settings section shows per-source contact counts
- [ ] Stats display updates after a sync completes
- [ ] Displays "0 contacts" when a source has no data (not hidden)
- [ ] All CI checks pass

## Implementation Notes

### Database Query

The `external_contacts` table has a `source` column with values: `'macos'`, `'iphone'`, `'outlook'`.

```sql
SELECT source, COUNT(*) as count
FROM external_contacts
WHERE user_id = ?
GROUP BY source
```

### New Function in `externalContactDbService.ts`

```typescript
export function getContactSourceStats(userId: string): Record<string, number> {
  const rows = dbAll<{ source: string; count: number }>(
    `SELECT source, COUNT(*) as count FROM external_contacts WHERE user_id = ? GROUP BY source`,
    [userId]
  );
  const stats: Record<string, number> = { macos: 0, iphone: 0, outlook: 0 };
  for (const row of rows) {
    stats[row.source] = row.count;
  }
  return stats;
}
```

### IPC Handler in `contact-handlers.ts`

```typescript
ipcMain.handle(
  "contacts:getSourceStats",
  async (_event: IpcMainInvokeEvent, userId: string) => {
    try {
      const stats = getContactSourceStats(userId);
      return { success: true, stats };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
);
```

### Preload in `contactBridge.ts`

```typescript
getSourceStats: (userId: string): Promise<{
  success: boolean;
  stats?: Record<string, number>;
  error?: string;
}> => ipcRenderer.invoke("contacts:getSourceStats", userId),
```

### UI in ContactsImportSettings

Display after TASK-1989's multi-source layout:
```tsx
{/* Source stats */}
{sourceStats && (
  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
    {isMacOS && (
      <div className="p-2 bg-violet-50 rounded border border-violet-200">
        <div className="text-lg font-semibold text-violet-700">{sourceStats.macos}</div>
        <div className="text-xs text-violet-600">macOS</div>
      </div>
    )}
    {sourceStats.iphone > 0 && (
      <div className="p-2 bg-blue-50 rounded border border-blue-200">
        <div className="text-lg font-semibold text-blue-700">{sourceStats.iphone}</div>
        <div className="text-xs text-blue-600">iPhone</div>
      </div>
    )}
    {isOutlookConnected && (
      <div className="p-2 bg-indigo-50 rounded border border-indigo-200">
        <div className="text-lg font-semibold text-indigo-700">{sourceStats.outlook}</div>
        <div className="text-xs text-indigo-600">Outlook</div>
      </div>
    )}
  </div>
)}
```

### Refresh After Sync

Listen for the sync orchestrator's `contacts` queue item completing (same pattern used in TASK-1989) and reload stats.

## Integration Notes

- Imports from: `externalContactDbService` (new function), `contactBridge` (new method)
- Exports to: N/A
- Used by: ContactsImportSettings component
- Depends on: TASK-1989 (multi-source import settings must be in place)

## Do / Don't

### Do:
- Use matching color schemes per source (violet=macOS, blue=iPhone, indigo=Outlook)
- Load stats on mount and after sync completes
- Handle loading state gracefully (show skeleton or "..." while loading)
- Follow existing patterns in `externalContactDbService.ts` for the query

### Don't:
- Don't add complex per-sync-run delta tracking
- Don't modify the external_contacts table schema
- Don't add stats for the `contacts` table (manual, email, etc.)
- Don't create a separate component for stats -- inline in ContactsImportSettings

## When to Stop and Ask

- If `externalContactDbService.ts` uses a different DB access pattern than `dbAll`
- If TASK-1989 has not been merged yet (this task depends on it)
- If the component exceeds 350 lines with stats added

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test `getContactSourceStats()` returns correct counts per source
  - Test `getContactSourceStats()` returns zeros for empty sources
  - Test stats display renders correct numbers
- Existing tests to update: None expected

### Coverage

- Coverage impact: Should increase (new DB function + test)

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

## PR Preparation

- **Title**: `feat(settings): add contact source stats breakdown`
- **Labels**: `ui`, `settings`, `contacts`
- **Depends on**: TASK-1989

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~15K

**Token Cap:** 60K (4x upper estimate)

> If you reach this cap, STOP and report to PM.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0 new files | +0K |
| Files to modify | 5 files (db, handlers, preload, types, component) | +8K |
| Code volume | ~60 lines total | +4K |
| Test complexity | Low (simple query test) | +3K |

**Confidence:** High

**Risk factors:**
- None significant -- straightforward query + display

**Similar past tasks:** Service category tasks average -31% to -45% variance

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files modified:
- [ ] electron/services/db/externalContactDbService.ts
- [ ] electron/contact-handlers.ts
- [ ] electron/preload/contactBridge.ts
- [ ] src/window.d.ts
- [ ] src/components/settings/MacOSContactsImportSettings.tsx (ContactsImportSettings)

Features implemented:
- [ ] getContactSourceStats DB query
- [ ] IPC handler registered
- [ ] Preload method added
- [ ] Stats UI rendered
- [ ] Auto-refresh after sync

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~15K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions>

**Deviations from plan:**
<If no deviations, write "None">

**Design decisions:**
<Document decisions>

**Issues encountered:**
<Document issues>

**Reviewer notes:**
<Anything for reviewer>

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~15K | ~XK | +/-X% |

---

## SR Engineer Review (SR-Owned)

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

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
