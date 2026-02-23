# Task TASK-2058: Local Failure Logging for Offline Diagnostics

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

Create a `FailureLogService` that persists network operation failures locally (in SQLite) so users have a diagnostic trail of what went wrong while offline or during network issues. After reconnection, surface a summary notification. Make the log accessible from the Settings page.

## Non-Goals

- Do NOT implement automatic retry of failed operations.
- Do NOT replace or modify Sentry error reporting (this complements Sentry for offline scenarios).
- Do NOT add export of failure logs (e.g., as CSV or JSON).
- Do NOT implement real-time failure notifications (toast per failure) -- only summary after reconnection.
- Do NOT create a standalone Failure Log page/route -- it goes in Settings as a section.

## Prerequisites

**Sprint:** SPRINT-095
**Depends on:** TASK-2056 (offline blocking) must be merged first. TASK-2056 adds timeouts to network calls that generate the timeout errors this service will log.
**Blocks:** Nothing.

## Context

Currently, when network operations fail:
- Some errors show briefly in the UI, then disappear
- Some errors are only logged to console
- Sentry captures errors -- but only when the device is online
- Users have no way to see what failed while they were offline

This task creates a local failure log that:
1. Persists failure records in the SQLite database
2. Shows a reconnection summary ("While offline, 3 operations failed: ...")
3. Provides a failure log viewer in Settings for support diagnostics

## Requirements

### Must Do:

1. **Create `FailureLogService`** in `electron/services/failureLogService.ts`:
   - `logFailure(operation: string, error: string, metadata?: Record<string, unknown>): Promise<void>`
   - `getRecentFailures(limit?: number): Promise<FailureLogEntry[]>`
   - `getFailuresSince(timestamp: Date): Promise<FailureLogEntry[]>`
   - `clearLog(): Promise<void>`
   - `getFailureCount(): Promise<number>`

2. **Create failure_log table** via migration:
   ```sql
   CREATE TABLE IF NOT EXISTS failure_log (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     timestamp TEXT NOT NULL DEFAULT (datetime('now')),
     operation TEXT NOT NULL,       -- e.g., 'outlook_contacts_sync', 'email_fetch', 'preferences_sync'
     error_message TEXT NOT NULL,
     metadata TEXT,                 -- JSON blob for extra context
     acknowledged INTEGER NOT NULL DEFAULT 0  -- 1 = user has seen this in summary
   );
   ```

3. **Add IPC handlers** for renderer to query failure log:
   - `failure-log:get-recent` -- returns recent failures
   - `failure-log:get-count` -- returns unacknowledged count
   - `failure-log:acknowledge-all` -- marks all as acknowledged
   - `failure-log:clear` -- clears entire log

4. **Integrate with network error handlers** -- Add `failureLogService.logFailure()` calls to catch blocks in:
   - Outlook contacts sync handler
   - Email sync handlers (Gmail, Outlook)
   - Supabase preferences sync
   - Sign Out All Devices handler
   - Update checker
   - Any other network operations that TASK-2056 added timeouts to

5. **Reconnection summary** -- When the app transitions from offline to online (listen to NetworkContext):
   - Query unacknowledged failures since last offline timestamp
   - If any exist, show a non-intrusive notification on the dashboard: "While offline, X operation(s) failed. View details in Settings."
   - Mark failures as acknowledged after showing summary

6. **Settings UI section** -- Add a "Diagnostic Log" or "Network Activity Log" section in Settings:
   - Show recent failures (last 50) in a scrollable list
   - Each entry shows: timestamp, operation name (human-readable), error message
   - "Clear Log" button
   - Minimal UI -- this is a support diagnostic tool, not a primary feature

7. **Retention policy** -- Automatically prune entries older than 30 days or when count exceeds 500 (whichever comes first). Run pruning on service initialization.

### Must NOT Do:

- Add real-time toast notifications per failure
- Create a separate page/route for the log viewer
- Export logs to external files
- Modify existing Sentry integration

## Acceptance Criteria

- [ ] `FailureLogService` creates, reads, and clears failure log entries in SQLite
- [ ] Failure log table is created via a versioned migration
- [ ] Network operation failures are logged by the service (at least 3 operation types integrated)
- [ ] Reconnection summary appears on dashboard after going offline -> online with failures
- [ ] Settings page shows a "Diagnostic Log" section with recent failures
- [ ] "Clear Log" button in Settings works
- [ ] Retention: entries older than 30 days are pruned on startup
- [ ] Retention: entries beyond 500 are pruned (oldest first)
- [ ] IPC channels work correctly (renderer can query log)
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Deliverables

### Files to Create

| File | Purpose |
|------|---------|
| `electron/services/failureLogService.ts` | Core service: log, query, prune failure entries |
| `electron/handlers/failureLogHandlers.ts` | IPC handlers for renderer access |
| `electron/database/migrations/XXXX-add-failure-log-table.sql` | Schema migration |

### Files to Modify

| File | Changes |
|------|---------|
| `electron/handlers/index.ts` | Register failure log handlers |
| `electron/preload/index.ts` | Expose failure log API |
| `src/window.d.ts` | Add failure log API type definitions |
| `src/components/Settings.tsx` | Add "Diagnostic Log" section |
| Various network handlers (from TASK-2056) | Add `failureLogService.logFailure()` calls in catch blocks |

### Files to Read (for context)

| File | Why |
|------|-----|
| `electron/services/databaseService.ts` | Understand migration system, DB access patterns |
| `src/contexts/NetworkContext.tsx` | Understand online/offline transition detection |
| `electron/handlers/sessionHandlers.ts` | Example handler pattern for IPC |
| `electron/preload/systemBridge.ts` | Example bridge pattern for IPC |

## Implementation Notes

### Operation type naming convention

Use snake_case identifiers matching the operation:

| Operation | Identifier |
|-----------|-----------|
| Outlook contacts sync | `outlook_contacts_sync` |
| Gmail email fetch | `gmail_email_fetch` |
| Outlook email fetch | `outlook_email_fetch` |
| Supabase preferences sync | `preferences_sync` |
| Sign Out All Devices | `sign_out_all_devices` |
| Check for Updates | `check_for_updates` |
| Supabase session sync | `session_sync` |

### Human-readable labels for UI

```typescript
const operationLabels: Record<string, string> = {
  outlook_contacts_sync: 'Outlook Contacts Sync',
  gmail_email_fetch: 'Gmail Email Fetch',
  outlook_email_fetch: 'Outlook Email Fetch',
  preferences_sync: 'Preferences Sync',
  sign_out_all_devices: 'Sign Out All Devices',
  check_for_updates: 'Check for Updates',
  session_sync: 'Session Sync',
};
```

### Migration version

Check `databaseService.ts` for the current highest migration version and use the next number. As of SPRINT-094, the baseline is 29 and versioned migrations start at 30. Check what the highest existing version is before creating the migration file.

### Reconnection summary pattern

```typescript
// In a dashboard-level hook or component:
const { isOnline } = useNetwork();
const wasOfflineRef = useRef(false);

useEffect(() => {
  if (!isOnline) {
    wasOfflineRef.current = true;
  } else if (wasOfflineRef.current) {
    wasOfflineRef.current = false;
    // Check for unacknowledged failures
    window.api.failureLog.getCount().then(count => {
      if (count > 0) {
        // Show notification
      }
    });
  }
}, [isOnline]);
```

## Testing Expectations

### Unit Tests

- **Required:** Yes
- **New tests to write:**
  1. `FailureLogService`: logFailure creates entry, getRecentFailures returns entries, clearLog removes all
  2. `FailureLogService`: pruning removes entries older than 30 days
  3. `FailureLogService`: pruning caps at 500 entries
  4. IPC handlers: get-recent returns data, acknowledge-all marks entries
  5. Settings UI: Diagnostic Log section renders with entries (mock IPC)

### CI Requirements

- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

## Estimation

- **Category:** service (new service + migration + IPC + UI)
- **Multiplier:** x 0.5
- **Base estimate:** ~40K tokens
- **Adjusted estimate:** ~20K tokens (but adding buffer for IPC boilerplate)
- **SR overhead:** +15K
- **Final estimate:** ~35K tokens
- **Token Cap:** 140K (4x of 35K)

## PR Preparation

- **Title:** `feat(diagnostics): add local failure logging for offline diagnostics`
- **Branch:** `feature/task-2058-failure-logging`
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
- **Actual Tokens**: ~XK (Est: 35K)
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- The migration version number conflicts with another in-flight task
- You need to modify the database connection management (dbConnection module)
- The Settings component is too large for a new section (may need extraction)
- More than 8 network handler files need modification (scope may need splitting)
- Existing tests fail in ways unrelated to this change
- You encounter blockers not covered in the task file
