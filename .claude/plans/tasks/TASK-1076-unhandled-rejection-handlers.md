# Task TASK-1076: Add Global Unhandled Rejection Handlers

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves and merges

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Task Overview

| Field | Value |
|-------|-------|
| **Task ID** | TASK-1076 |
| **Sprint** | SPRINT-039 |
| **Backlog Item** | BACKLOG-233 |
| **Priority** | MEDIUM |
| **Phase** | 1 |
| **Category** | security |
| **Estimated Tokens** | ~15K |
| **Token Cap** | 60K |

---

## Goal

Add global handlers for `uncaughtException` and `unhandledRejection` events in the Electron main process to prevent silent crashes and improve error visibility.

## Non-Goals

- Do NOT change existing error handling in specific modules
- Do NOT add auto-restart functionality
- Do NOT modify renderer process error handling
- Do NOT add crash reporting to external services

## Deliverables

1. Update: `electron/main.ts` - Add global exception handlers
2. New: Unit tests for handler registration

## Acceptance Criteria

- [ ] Global `uncaughtException` handler added
- [ ] Global `unhandledRejection` handler added
- [ ] Handlers log errors with full stack trace
- [ ] Handlers do NOT crash the app (graceful handling)
- [ ] Handlers are registered before any async operations
- [ ] Unit tests verify handler registration
- [ ] All CI checks pass

## Implementation Notes

### Problem Analysis

Unhandled promise rejections and uncaught exceptions can:
1. Crash the app silently without user notification
2. Leave the app in an inconsistent state
3. Make debugging difficult without proper logging

### Key Patterns

Add to top of `electron/main.ts`:

```typescript
// Global error handlers - must be registered early
process.on('uncaughtException', (error: Error) => {
  console.error('[FATAL] Uncaught Exception:', error.message);
  console.error(error.stack);

  // Log to file if logging service is available
  // Do NOT exit - let Electron handle graceful shutdown
  // The dialog module may not be available yet at startup

  // Optional: Show error dialog to user
  // dialog.showErrorBox('Unexpected Error', error.message);
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  console.error('[ERROR] Unhandled Promise Rejection:', reason);
  if (reason instanceof Error) {
    console.error(reason.stack);
  }

  // Log but do not crash
  // Unhandled rejections are often recoverable
});
```

### Important Details

1. Register handlers at the very top of main.ts (before imports if possible)
2. Use `console.error` for logging (always available)
3. Log full stack traces for debugging
4. Do NOT call `process.exit()` - let Electron handle shutdown
5. Consider showing user-friendly dialog for fatal errors
6. In development, may want to exit for visibility

### Development vs Production

```typescript
const isDev = process.env.NODE_ENV === 'development';

process.on('uncaughtException', (error: Error) => {
  console.error('[FATAL] Uncaught Exception:', error);

  if (isDev) {
    // In dev, throw to make errors visible
    throw error;
  }

  // In production, log and continue
  // Show error dialog to user
});
```

## Integration Notes

- Imports from: None (uses native process events)
- Exports to: None (global handlers)
- Used by: Entire main process
- Depends on: None

## Do / Don't

### Do:

- Register handlers at the very top of main.ts
- Log full error details including stack trace
- Handle both sync (uncaughtException) and async (unhandledRejection) errors
- Keep handlers simple and safe (avoid async operations in handler)

### Don't:

- Call `process.exit()` in handlers (breaks graceful shutdown)
- Use async operations in handlers (may hang)
- Swallow errors without logging
- Add auto-restart logic (can cause restart loops)
- Modify other error handling in the codebase

## When to Stop and Ask

- If existing error handlers conflict with global handlers
- If you find critical code relying on crashes for restarts
- If global handlers cause test failures
- If you're unsure about dialog availability at startup

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test that uncaughtException handler is registered
  - Test that unhandledRejection handler is registered
  - Test handler logs to console.error
  - Test handler does not exit process

### Coverage

- Coverage impact: Slight increase

### Integration / Feature Tests

- Required scenarios:
  - Trigger unhandled rejection, verify app doesn't crash
  - Verify error is logged to console

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(electron): add global unhandled rejection handlers`
- **Labels**: `stability`, `error-handling`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `security`

**Estimated Tokens:** ~15K

**Token Cap:** 60K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 1 (main.ts) | +5K |
| Implementation | Simple event handlers | +5K |
| Testing | Basic handler tests | +5K |

**Confidence:** High

**Risk factors:**
- May conflict with existing error handling (low risk)
- Handler placement is important

**Similar past tasks:** Security category uses 0.4x multiplier

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
- [ ] electron/main.ts

Features implemented:
- [ ] uncaughtException handler
- [ ] unhandledRejection handler
- [ ] Logging with stack traces
- [ ] Graceful error handling (no crash)

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Manual testing of error scenarios
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~15K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~15K | ~XK | +/-X% |
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

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

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

---

## Related Items

| ID | Title | Relationship |
|----|-------|-------------|
| BACKLOG-233 | Missing Unhandled Rejection Handlers | Source backlog item |
