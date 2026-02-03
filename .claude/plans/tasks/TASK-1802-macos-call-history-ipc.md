# Task TASK-1802: macOS Call History IPC Handlers

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

Create IPC handlers to expose the macOS call history import service to the renderer process, following the same patterns as messageImportHandlers.ts.

## Non-Goals

- Do NOT implement the import service itself (TASK-1801)
- Do NOT implement UI components (TASK-1805)
- Do NOT implement Windows-specific handlers (handled via existing sync handlers)
- Do NOT add preload API (use existing patterns)

## Deliverables

1. New file: `electron/handlers/callLogHandlers.ts`
2. Update: `electron/handlers/index.ts` - Register new handlers
3. Update: `electron/preload/api.ts` - Expose call log API to renderer
4. Update: `src/window.d.ts` - TypeScript types for window.api.callLogs

## Acceptance Criteria

- [ ] IPC handler `calls:import-macos` triggers import service
- [ ] Progress events sent via `calls:import-progress` channel
- [ ] Handler checks platform (macOS only for this endpoint)
- [ ] Handler verifies user exists before import
- [ ] Preload API exposes `window.api.callLogs.importMacOS()`
- [ ] Preload API exposes `window.api.callLogs.onProgress()` for progress events
- [ ] TypeScript types added to window.d.ts
- [ ] Handler registration prevents duplicates
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Implementation Notes

### Handler Pattern (Follow messageImportHandlers.ts)

```typescript
// electron/handlers/callLogHandlers.ts

import { ipcMain, BrowserWindow } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import logService from '../services/logService';
import databaseService from '../services/databaseService';
import macOSCallHistoryImportService from '../services/macOSCallHistoryImportService';
import type {
  MacOSCallImportResult,
  CallImportProgressCallback,
} from '../services/macOSCallHistoryImportService';

// Track registration to prevent duplicate handlers
let handlersRegistered = false;

// Track import start time for elapsed time calculation
let importStartTime: number | null = null;

/**
 * Register call log IPC handlers
 */
export function registerCallLogHandlers(mainWindow: BrowserWindow): void {
  // Prevent double registration
  if (handlersRegistered) {
    logService.warn(
      'Call log handlers already registered, skipping duplicate registration',
      'CallLogHandlers'
    );
    return;
  }
  handlersRegistered = true;

  /**
   * Import call history from macOS CallHistoryDB
   * IPC: calls:import-macos
   *
   * @param userId - The user ID to associate calls with
   * @param forceReimport - If true, delete existing calls first
   * @returns Import result with counts and status
   */
  ipcMain.handle(
    'calls:import-macos',
    async (
      _event: IpcMainInvokeEvent,
      userId: string,
      forceReimport = false
    ): Promise<MacOSCallImportResult> => {
      // Verify user exists
      // Track start time
      // Create progress callback that sends to renderer
      // Call import service
      // Return result
    }
  );

  /**
   * Check if call history import is available
   * IPC: calls:check-availability
   */
  ipcMain.handle(
    'calls:check-availability',
    async (): Promise<{ available: boolean; reason?: string }> => {
      return macOSCallHistoryImportService.isAvailable();
    }
  );
}
```

### Preload API Pattern

```typescript
// In electron/preload/api.ts, add:

callLogs: {
  /**
   * Import call history from macOS (macOS only)
   */
  importMacOS: (userId: string, forceReimport?: boolean): Promise<MacOSCallImportResult> => {
    return ipcRenderer.invoke('calls:import-macos', userId, forceReimport);
  },

  /**
   * Check if call import is available
   */
  checkAvailability: (): Promise<{ available: boolean; reason?: string }> => {
    return ipcRenderer.invoke('calls:check-availability');
  },

  /**
   * Subscribe to import progress events
   */
  onProgress: (callback: (progress: CallImportProgress) => void): () => void => {
    const handler = (_event: IpcRendererEvent, progress: CallImportProgress) => {
      callback(progress);
    };
    ipcRenderer.on('calls:import-progress', handler);
    return () => {
      ipcRenderer.removeListener('calls:import-progress', handler);
    };
  },
},
```

### Window Types (src/window.d.ts)

```typescript
// Add to window.d.ts

interface CallImportProgress {
  phase: 'checking' | 'querying' | 'importing';
  current: number;
  total: number;
  percent: number;
  elapsedMs?: number;
}

interface MacOSCallImportResult {
  success: boolean;
  callsImported: number;
  callsSkipped: number;
  callsLinked: number;
  duration: number;
  error?: string;
}

interface CallLogsApi {
  importMacOS(userId: string, forceReimport?: boolean): Promise<MacOSCallImportResult>;
  checkAvailability(): Promise<{ available: boolean; reason?: string }>;
  onProgress(callback: (progress: CallImportProgress) => void): () => void;
}

// In Window interface:
interface Window {
  api: {
    // ... existing
    callLogs: CallLogsApi;
  };
}
```

### Handler Registration

In `electron/handlers/index.ts`, add:

```typescript
import { registerCallLogHandlers } from './callLogHandlers';

// In the registration function:
registerCallLogHandlers(mainWindow);
```

## Integration Notes

- Imports from: `electron/services/macOSCallHistoryImportService.ts` (TASK-1801)
- Exports to: Renderer via preload API
- Used by: TASK-1805 (UI), TASK-1807 (sync integration)
- Depends on: TASK-1801 (import service)
- Pattern follows: `electron/handlers/messageImportHandlers.ts`

## Do / Don't

### Do:

- Follow messageImportHandlers.ts patterns exactly
- Include elapsed time tracking in progress events
- Verify user exists before import (with fallback for migrated IDs)
- Log all operations for debugging
- Prevent duplicate handler registration

### Don't:

- Don't expose raw SQLite operations via IPC
- Don't skip user validation
- Don't forget to send progress events
- Don't forget cleanup function for progress listener

## When to Stop and Ask

- If preload API patterns differ from expected
- If handler registration approach is unclear
- If window.d.ts structure has changed

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `callLogHandlers.test.ts`
  - Test handler registration
  - Test IPC invoke returns correct result
  - Test progress events are emitted
- Existing tests to update:
  - None expected

### Coverage

- Coverage impact: New handlers should have test coverage

### Integration / Feature Tests

- Required scenarios:
  - IPC call triggers import service
  - Progress events reach renderer
  - Error handling for missing user

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks
- [ ] Build step

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(calls): add macOS call history IPC handlers`
- **Labels**: `feature`, `ipc`, `macos`
- **Depends on**: TASK-1801

---

## PM Estimate (PM-Owned)

**Category:** `ipc`

**Estimated Tokens:** ~12K-15K

**Token Cap:** 60K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 1 new handler file | +5K |
| Files to modify | 3 files (index, preload, window.d.ts) | +5K |
| Code volume | ~200 lines handlers + types | +3K |
| Test complexity | Low - mocked IPC | +2K |

**Confidence:** High

**Risk factors:**
- Preload API patterns may have evolved

**Similar past tasks:** IPC tasks use x1.5 multiplier = ~18K

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
- [ ] electron/handlers/callLogHandlers.ts
- [ ] electron/handlers/__tests__/callLogHandlers.test.ts

Files modified:
- [ ] electron/handlers/index.ts
- [ ] electron/preload/api.ts
- [ ] src/window.d.ts

Features implemented:
- [ ] calls:import-macos handler
- [ ] calls:check-availability handler
- [ ] Progress event emission
- [ ] Preload API exposure

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

**Variance:** PM Est ~18K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~18K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation of why estimate was off>

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
