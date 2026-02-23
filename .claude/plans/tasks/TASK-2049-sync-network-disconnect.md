# Task TASK-2049: Sync Fails on Network Disconnect

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

Add network resilience to email sync operations so that when the network drops mid-sync, already-fetched data is saved, the user sees a clear status message, and sync automatically retries when connectivity is restored.

## Non-Goals

- Do NOT add network resilience to iMessage import (iMessage reads from local DB, no network needed)
- Do NOT add network resilience to Supabase cloud sync (separate concern, different service)
- Do NOT add a network status indicator in the UI (future sprint)
- Do NOT change the sync scheduling/trigger logic
- Do NOT add offline mode for the full app (only graceful degradation during email sync)

## Deliverables

1. Update: `electron/handlers/emailSyncHandlers.ts` -- Add try/catch with partial save and retry logic
2. Update: `electron/services/gmailFetchService.ts` -- Add network error detection and partial result return
3. Update: `electron/services/outlookFetchService.ts` -- Add network error detection and partial result return
4. New: `electron/services/networkStateService.ts` -- Simple network connectivity detection (or add to existing service if one exists)
5. Update tests: `electron/services/__tests__/gmailFetchService.test.ts` -- Network failure scenarios
6. Update tests: `electron/services/__tests__/outlookFetchService.test.ts` -- Network failure scenarios

## Acceptance Criteria

- [ ] When network drops during email sync, already-fetched emails are saved to the local database
- [ ] Sync failure due to network disconnect shows a user-friendly error message (not a raw exception)
- [ ] When network connectivity is restored, sync automatically retries from where it left off
- [ ] Retry uses exponential backoff (1s, 2s, 4s, 8s, max 30s) with a maximum of 5 retries
- [ ] Partial sync progress is preserved -- if 3 of 5 folders were synced before disconnect, only folders 4 and 5 are retried
- [ ] Network state detection works on both macOS and Windows
- [ ] No regression in sync behavior when network is stable
- [ ] All CI checks pass (`npm run type-check`, `npm run lint`, `npm test`)

## Implementation Notes

### Network State Detection

Electron provides a built-in network detection API:

```typescript
import { net } from 'electron';

// Simple check
function isOnline(): boolean {
  return net.isOnline();
}

// Listen for changes
import { app } from 'electron';

app.on('online', () => {
  // Network restored -- trigger retry
});

app.on('offline', () => {
  // Network lost -- pause sync
});
```

Alternatively, use Node.js DNS lookup as a fallback:

```typescript
import dns from 'dns';

async function checkConnectivity(): Promise<boolean> {
  return new Promise((resolve) => {
    dns.resolve('dns.google', (err) => {
      resolve(!err);
    });
  });
}
```

### Partial Save Strategy

The key insight is that email sync already processes emails one at a time (or in batches). The fix is to commit each batch to the database before fetching the next one, rather than waiting until all emails are fetched:

```typescript
async function syncFolderWithResilience(
  folderId: string,
  fetchService: EmailFetchService,
): Promise<SyncResult> {
  let pageToken: string | undefined;
  let savedCount = 0;

  while (true) {
    try {
      const page = await fetchService.fetchPage(folderId, pageToken);

      // Save this page immediately (partial save)
      await saveEmailBatch(page.emails);
      savedCount += page.emails.length;

      if (!page.nextPageToken) break;
      pageToken = page.nextPageToken;
    } catch (error) {
      if (isNetworkError(error)) {
        return {
          status: 'partial',
          savedCount,
          lastPageToken: pageToken,
          folderId,
          error: 'Network disconnected during sync',
        };
      }
      throw error; // Non-network errors still throw
    }
  }

  return { status: 'complete', savedCount };
}
```

### Network Error Detection

```typescript
function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const networkMessages = [
      'ENOTFOUND',
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'EAI_AGAIN',
      'ENETUNREACH',
      'ENETDOWN',
      'fetch failed',
      'network error',
      'ERR_INTERNET_DISCONNECTED',
    ];
    const msg = error.message.toLowerCase();
    return networkMessages.some(nm => msg.includes(nm.toLowerCase()));
  }
  return false;
}
```

### Retry with Exponential Backoff

```typescript
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

async function retryOnNetwork<T>(
  operation: () => Promise<T>,
  config: RetryConfig = { maxRetries: 5, baseDelayMs: 1000, maxDelayMs: 30000 },
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isNetworkError(error) || attempt === config.maxRetries) {
        throw error;
      }
      lastError = error as Error;

      const delay = Math.min(
        config.baseDelayMs * Math.pow(2, attempt),
        config.maxDelayMs,
      );

      await logService.warn(
        `Network error during sync, retrying in ${delay}ms (attempt ${attempt + 1}/${config.maxRetries})`,
        "EmailSync",
      );

      // Wait for delay OR network restoration, whichever comes first
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
```

### Auto-Retry on Reconnect

```typescript
class EmailSyncResumeService {
  private pendingRetries: Map<string, SyncResumeState> = new Map();

  constructor() {
    // Listen for network restoration
    app.on('online', () => {
      this.retryPendingSync();
    });
  }

  recordPartialSync(result: PartialSyncResult): void {
    this.pendingRetries.set(result.folderId, {
      folderId: result.folderId,
      lastPageToken: result.lastPageToken,
      savedCount: result.savedCount,
      failedAt: new Date(),
    });
  }

  async retryPendingSync(): Promise<void> {
    for (const [folderId, state] of this.pendingRetries) {
      try {
        await resumeSyncFromToken(folderId, state.lastPageToken);
        this.pendingRetries.delete(folderId);
      } catch (error) {
        // Will retry on next 'online' event
      }
    }
  }
}
```

### Key Files to Study

- `electron/handlers/emailSyncHandlers.ts` -- Where sync is initiated from the UI
- `electron/services/gmailFetchService.ts` -- Gmail API calls that can fail on network
- `electron/services/outlookFetchService.ts` -- Outlook API calls that can fail on network
- `electron/services/syncStatusService.ts` -- Existing sync status tracking

## Integration Notes

- Depends on: TASK-2046 (email sync custom folders) -- retry logic must cover all folders, not just Inbox/Sent
- Depends on: TASK-2047 patterns may inform chunked processing approach
- Imports from: `gmailFetchService.ts`, `outlookFetchService.ts`, `emailSyncHandlers.ts`
- Related: `syncStatusService.ts` -- should report network-related sync status
- Related: `emailDeduplicationService.ts` -- retried emails must still be deduplicated

## Do / Don't

### Do:
- Save emails to database in batches as they arrive (not all at end)
- Use Electron's built-in `net.isOnline()` for connectivity detection
- Log all retry attempts with clear context
- Emit sync status events that the UI can display ("Sync paused -- no network", "Retrying...")
- Handle both Gmail and Outlook network errors consistently

### Don't:
- Retry indefinitely -- cap at 5 retries with exponential backoff
- Discard already-fetched emails on network failure
- Block the UI during retry waits (use async/await, not sync sleep)
- Create a separate process or worker for network monitoring
- Change the sync trigger logic (when sync starts)

## When to Stop and Ask

- If email fetch services don't support pagination (no page tokens for resume)
- If Electron's `net.isOnline()` is unreliable on the target platforms
- If the existing sync flow batches all database writes at the end (major refactor needed)
- If adding retry logic would require changes to the Gmail/Outlook OAuth token refresh flow

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `isNetworkError` correctly identifies network-related errors
  - `retryOnNetwork` retries on network errors, gives up after max retries
  - `retryOnNetwork` does not retry on non-network errors
  - Partial sync saves already-fetched emails on network failure
  - Exponential backoff delays are calculated correctly
  - Auto-retry triggers when 'online' event fires
- Existing tests to update:
  - `gmailFetchService.test.ts` -- add network failure mock scenarios
  - `outlookFetchService.test.ts` -- add network failure mock scenarios

### Coverage

- Coverage impact: Must not decrease overall coverage

### Integration / Feature Tests

- Required scenarios:
  - Full sync completes normally when network is stable
  - Network drops after 2 pages -- first 2 pages saved, retry fetches remaining
  - Network drops and never comes back -- 5 retries then clear error

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(sync): add network resilience with partial save and auto-retry`
- **Labels**: `bug`, `sync`, `resilience`
- **Depends on**: TASK-2046 (email sync custom folders), TASK-2047 (UI freeze fix)

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~25K-45K

**Token Cap:** 180K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 1 new file (networkStateService or similar) | +5K |
| Files to modify | 3-4 files (scope: medium) | +18K |
| Code volume | ~200-300 lines new/modified | +12K |
| Test complexity | Medium-High (mocking network errors, async retry) | +10K |

**Confidence:** Medium

**Risk factors:**
- Gmail and Outlook may have different error shapes for network failures
- Pagination/resume token behavior may differ between providers
- Electron `net.isOnline()` reliability unknown on all platforms

**Similar past tasks:** None directly comparable

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
- [ ] electron/services/networkStateService.ts (or equivalent)

Features implemented:
- [ ] Network error detection (isNetworkError)
- [ ] Partial save on network disconnect
- [ ] Exponential backoff retry
- [ ] Auto-retry on network restoration
- [ ] Sync status events for UI

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

**Variance:** PM Est ~35K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~35K | ~XK | +/-X% |
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
