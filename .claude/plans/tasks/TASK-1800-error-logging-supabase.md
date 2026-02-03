# Task TASK-1800: Production Error Logging to Supabase

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

---

## Goal

Implement client-side error logging that submits user-facing errors to the existing `error_logs` Supabase table, enabling production monitoring of issues users encounter.

## Non-Goals

- Do NOT create Supabase migrations (table already exists)
- Do NOT implement error aggregation or deduplication
- Do NOT add automated alerting
- Do NOT log every console.error - only user-facing errors from ErrorScreen
- Do NOT include message/email content in logs (PII concern)

## Deliverables

1. New file: `electron/services/errorLoggingService.ts` - Service to submit errors to Supabase
2. Update: `src/appCore/state/machine/components/ErrorScreen.tsx` - Add submit feedback UI
3. New file: `electron/handlers/errorLoggingHandlers.ts` - IPC handlers for error submission
4. Update: `electron/handlers/index.ts` - Register new handlers
5. Update: `electron/preload.ts` - Expose error logging API

## Acceptance Criteria

- [ ] ErrorLoggingService can submit errors to Supabase `error_logs` table
- [ ] ErrorScreen shows optional feedback textarea
- [ ] ErrorScreen has "Submit Error Report" button
- [ ] Submitted reports include: error details, app version, OS info, breadcrumbs
- [ ] User feedback text is included when provided
- [ ] Errors queue locally if offline and submit when online
- [ ] No PII (message content, contact names) included in logs
- [ ] All CI checks pass
- [ ] TypeScript strict mode compliant

## Implementation Notes

### Supabase error_logs Schema (Already Exists)

The table has these relevant columns:
```sql
- id: uuid (auto-generated)
- user_id: uuid (nullable, FK to users)
- device_id: text
- session_id: text
- app_version: text (required)
- electron_version: text
- os_name: text
- os_version: text
- platform: text
- error_type: text (required)
- error_code: text
- error_message: text (required)
- stack_trace: text
- current_screen: text
- user_feedback: text
- breadcrumbs: jsonb
- app_state: jsonb
- network_status: text
- memory_usage_mb: integer
- disk_free_gb: numeric
- error_timestamp: timestamptz
- created_at: timestamptz
```

### ErrorLoggingService Pattern

```typescript
// electron/services/errorLoggingService.ts
import { getSupabaseClient } from './supabaseClient';
import { app } from 'electron';
import os from 'os';

interface ErrorLogPayload {
  errorType: string;
  errorCode?: string;
  errorMessage: string;
  stackTrace?: string;
  currentScreen?: string;
  userFeedback?: string;
  breadcrumbs?: Record<string, unknown>[];
  appState?: Record<string, unknown>;
}

export class ErrorLoggingService {
  private static instance: ErrorLoggingService;
  private offlineQueue: ErrorLogPayload[] = [];

  static getInstance(): ErrorLoggingService {
    if (!ErrorLoggingService.instance) {
      ErrorLoggingService.instance = new ErrorLoggingService();
    }
    return ErrorLoggingService.instance;
  }

  async submitError(payload: ErrorLogPayload): Promise<{ success: boolean; errorId?: string }> {
    const supabase = getSupabaseClient();

    // Get current user if available
    const { data: { user } } = await supabase.auth.getUser();

    const logEntry = {
      user_id: user?.id ?? null,
      device_id: this.getDeviceId(),
      app_version: app.getVersion(),
      electron_version: process.versions.electron,
      os_name: os.type(),
      os_version: os.release(),
      platform: process.platform,
      error_type: payload.errorType,
      error_code: payload.errorCode,
      error_message: payload.errorMessage,
      stack_trace: payload.stackTrace,
      current_screen: payload.currentScreen,
      user_feedback: payload.userFeedback,
      breadcrumbs: payload.breadcrumbs,
      app_state: this.sanitizeAppState(payload.appState),
      network_status: navigator.onLine ? 'online' : 'offline',
      error_timestamp: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('error_logs')
      .insert(logEntry)
      .select('id')
      .single();

    if (error) {
      // Queue for retry if offline
      this.offlineQueue.push(payload);
      return { success: false };
    }

    return { success: true, errorId: data.id };
  }

  private sanitizeAppState(appState?: Record<string, unknown>): Record<string, unknown> | null {
    if (!appState) return null;
    // Remove any PII - don't include transaction details, contacts, messages
    const { transactions, contacts, messages, ...safeState } = appState as Record<string, unknown>;
    return safeState;
  }

  private getDeviceId(): string {
    // Use existing device ID from license system or generate
    // Implementation depends on existing device identification
    return ''; // TODO: Get from existing device service
  }
}
```

### IPC Handler Pattern

```typescript
// electron/handlers/errorLoggingHandlers.ts
import { ipcMain } from 'electron';
import { ErrorLoggingService } from '../services/errorLoggingService';

export function registerErrorLoggingHandlers(): void {
  ipcMain.handle('error-logging:submit', async (_event, payload) => {
    const service = ErrorLoggingService.getInstance();
    return service.submitError(payload);
  });
}
```

### Preload API

```typescript
// Add to electron/preload.ts
errorLogging: {
  submit: (payload: ErrorLogPayload) => ipcRenderer.invoke('error-logging:submit', payload),
},
```

### ErrorScreen Enhancement

```tsx
// Update src/appCore/state/machine/components/ErrorScreen.tsx
import { useState } from 'react';

export function ErrorScreen({ error, onRetry }: ErrorScreenProps): React.ReactElement {
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmitReport = async () => {
    setIsSubmitting(true);
    try {
      await window.api.errorLogging.submit({
        errorType: 'app_error',
        errorCode: error.code,
        errorMessage: error.message,
        userFeedback: feedback,
        currentScreen: 'ErrorScreen',
      });
      setSubmitted(true);
    } catch (e) {
      // Silent fail - don't show another error
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // ... existing UI ...
    {!submitted && (
      <>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="What were you doing when this happened? (optional)"
          className="w-full p-3 border rounded-lg mb-4"
          rows={3}
        />
        <button
          onClick={handleSubmitReport}
          disabled={isSubmitting}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg mr-2"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Error Report'}
        </button>
      </>
    )}
    {submitted && (
      <p className="text-green-600 mb-4">Thank you! Your report has been submitted.</p>
    )}
  );
}
```

## Integration Notes

- Imports from: `electron/services/supabaseClient.ts`
- Exports to: `electron/handlers/index.ts`, `electron/preload.ts`
- Used by: ErrorScreen component, potentially ErrorBoundary
- Depends on: None (first task in sprint)

## Do / Don't

### Do:
- Sanitize app state to remove PII before logging
- Include helpful debugging info (OS, version, electron version)
- Make feedback textarea optional
- Show confirmation after submission
- Handle offline gracefully (queue for later)
- Use existing Supabase client patterns

### Don't:
- Include transaction content, message bodies, or contact details
- Block the UI waiting for submission
- Show errors if submission fails (user already has an error)
- Create new Supabase tables or migrations
- Log every error - only user-facing ErrorScreen errors

## When to Stop and Ask

- If the Supabase `error_logs` table structure doesn't match documentation
- If RLS policies block error log inserts for authenticated users
- If existing device identification is unclear
- If the preload API pattern differs from documented approach

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `errorLoggingService.test.ts`: Test payload construction, sanitization
  - Test offline queueing behavior
- Existing tests to update:
  - None expected

### Coverage

- Coverage impact: Must not decrease
- ErrorLoggingService should have >80% coverage

### Integration / Feature Tests

- Required scenarios:
  - Submit error with feedback, verify in Supabase
  - Submit error without feedback
  - Submit error when offline (should queue)

### CI Requirements

This task's PR MUST pass:
- [x] Unit tests
- [x] Integration tests (if applicable)
- [x] Coverage checks
- [x] Type checking
- [x] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(error-logging): submit user errors to Supabase (BACKLOG-613)`
- **Labels**: `critical`, `feature`, `onboarding`
- **Base Branch**: `main`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~20K-25K

**Token Cap:** 100K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 2 new files | +10K |
| Files to modify | 3 files (ErrorScreen, handlers/index, preload) | +8K |
| Code volume | ~300 lines | +5K |
| Test complexity | Medium | +5K |

**Confidence:** High

**Risk factors:**
- RLS policy might need adjustment
- Device ID retrieval pattern unclear

**Similar past tasks:** Service tasks typically come in at 0.5x estimate

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
- [ ] electron/services/errorLoggingService.ts
- [ ] electron/handlers/errorLoggingHandlers.ts

Files updated:
- [ ] src/appCore/state/machine/components/ErrorScreen.tsx
- [ ] electron/handlers/index.ts
- [ ] electron/preload.ts

Features implemented:
- [ ] Error submission to Supabase
- [ ] User feedback textarea in ErrorScreen
- [ ] Submit button with loading state
- [ ] Success confirmation message

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

**Variance:** PM Est ~25K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase>

**Deviations from plan:**
<If any, explain what and why>

**Design decisions:**
<Document any design decisions>

**Issues encountered:**
<Document any issues>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** main
