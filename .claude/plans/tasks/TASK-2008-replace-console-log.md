# TASK-2008: Replace console.log Statements with Structured Logging

**Backlog ID:** BACKLOG-726
**Sprint:** SPRINT-087
**Phase:** Phase 1 - Code Cleanup
**Branch:** `chore/task-2008-replace-console-log`
**Estimated Tokens:** ~8K

---

## Objective

Replace 83 `console.log` calls across 22 production files with either the existing `logService` (electron/ main process) or a new lightweight renderer logger (src/ renderer process). Skip test files -- console.log in tests is acceptable.

---

## Context

The project has a structured `LogService` at `electron/services/logService.ts` with debug/info/warn/error levels, file output, and context tagging. However, 83 `console.log` calls remain scattered across production code. This looks unprofessional to a reviewer and loses structured metadata (timestamps, levels, context).

### Scope Scan Results

**Renderer (src/) -- 77 occurrences across 17 files:**

| File | Count | Notes |
|------|-------|-------|
| `src/appCore/state/machine/LoadingOrchestrator.tsx` | 24 | Heaviest -- loading phase logging |
| `src/hooks/useIPhoneSync.ts` | 14 | Sync progress |
| `src/services/SyncOrchestratorService.ts` | 14 | Sync orchestration |
| `src/components/onboarding/steps/PermissionsStep.tsx` | 7 | Permission checks |
| `src/appCore/state/machine/debug.ts` | 5 | Debug utility (console.log is intentional here) |
| `src/appCore/state/flows/usePhoneTypeApi.ts` | 2 | API calls |
| Other files (11 files) | 1 each | Scattered |

**Electron main process (electron/) -- 3 real occurrences across 2 production files:**

| File | Count | Notes |
|------|-------|-------|
| `electron/services/databaseService.ts` | 2 | Lines 316, 348 — real calls (also 1 `console.warn` at line 318) |
| `electron/main.ts` | 1 | Line 602 — CSP dev mode message |

**NOTE:** `syncOrchestrator.ts`, `deviceDetectionService.ts`, and `syncStatusService.ts` contain `console.log` only inside JSDoc comments (example code), NOT executable code. Do NOT modify those files.

**Test files (skip) -- 74 occurrences across 3 test files:**
- `electron/services/__tests__/cost-measurement.test.ts` (27)
- `electron/services/extraction/__tests__/extraction-accuracy.test.ts` (19)
- `electron/services/__tests__/performance-benchmark.test.ts` (24)
- `electron/services/__tests__/nativeModules.test.ts` (4)

---

## Requirements

### Must Do:

1. **Create a lightweight renderer logger** at `src/utils/logger.ts`:
   ```typescript
   /**
    * Renderer-side logger
    * Wraps console methods with structured prefix and level control.
    * In production builds, debug-level logs are suppressed.
    */
   type LogLevel = 'debug' | 'info' | 'warn' | 'error';

   const LOG_LEVELS: Record<LogLevel, number> = {
     debug: 0, info: 1, warn: 2, error: 3,
   };

   const MIN_LEVEL: LogLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

   function shouldLog(level: LogLevel): boolean {
     return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL];
   }

   export const logger = {
     debug: (msg: string, ...args: unknown[]) => {
       if (shouldLog('debug')) console.debug(`[DEBUG] ${msg}`, ...args);
     },
     info: (msg: string, ...args: unknown[]) => {
       if (shouldLog('info')) console.info(`[INFO] ${msg}`, ...args);
     },
     warn: (msg: string, ...args: unknown[]) => {
       if (shouldLog('warn')) console.warn(`[WARN] ${msg}`, ...args);
     },
     error: (msg: string, ...args: unknown[]) => {
       if (shouldLog('error')) console.error(`[ERROR] ${msg}`, ...args);
     },
   };

   export default logger;
   ```
   Note: This is a reference implementation. Adjust based on project patterns, but keep it simple. The goal is structured output, not a full logging framework.

2. **Replace console.log in src/ files** with `logger.debug()` or `logger.info()`:
   - Use `logger.debug()` for development-only logging (state transitions, flag values, sync progress details)
   - Use `logger.info()` for operational logging (sync started, sync completed, phase transitions)
   - Use `logger.warn()` for warning conditions
   - Use `logger.error()` for error conditions (replace any `console.error` too)

3. **Replace console.log in electron/ production files** with `logService`:
   - Import: `import logService from './logService';` (adjust path)
   - Replace `console.log(msg)` with `logService.info(msg, 'context')` where context is the service name
   - Only 2 files need changes: `databaseService.ts` (2 console.log + 1 console.warn) and `main.ts` (1 console.log)
   - Do NOT modify `syncOrchestrator.ts`, `deviceDetectionService.ts`, or `syncStatusService.ts` — their `console.log` references are inside JSDoc comments only

4. **Replace console.error/console.warn in files you're already touching:**
   - When replacing `console.log` in a file, also convert any `console.error` → `logger.error()` and `console.warn` → `logger.warn()` in that same file
   - Do NOT do a separate sweep across the entire codebase for console.error/console.warn — only convert them in files already being modified for console.log

4. **Handle debug.ts specially:**
   - `src/appCore/state/machine/debug.ts` is a debug utility that intentionally uses `console.log` with styled output (`%c` formatting)
   - Replace with `logger.debug()` calls BUT preserve the styled output for dev mode
   - Change `DEBUG_ENABLED` to use `process.env.NODE_ENV !== 'production'` instead of hardcoded `true`

### Must NOT Do:
- Do NOT modify test files (console.log in tests is fine)
- Do NOT change the existing `electron/services/logService.ts` implementation
- Do NOT add file-based logging to the renderer (renderer logs to DevTools console only)
- Do NOT remove error logging that is part of catch blocks -- convert to `logger.error()`
- Do NOT change any logic -- only replace the logging mechanism

---

## Acceptance Criteria

- [ ] `src/utils/logger.ts` created with debug/info/warn/error levels
- [ ] Zero `console.log` calls remain in src/ production files (excluding test files and debug.ts if styled output preserved)
- [ ] Zero `console.log` calls remain in electron/ production files (excluding test files)
- [ ] `debug.ts` uses `process.env.NODE_ENV` check instead of hardcoded `true`
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes with no failures
- [ ] Verify command: `grep -r "console\.log" --include="*.ts" --include="*.tsx" src/ electron/ | grep -v __tests__ | grep -v node_modules | grep -v ".test."` returns zero results for production files

---

## Files to Create

- `src/utils/logger.ts` - Renderer-side structured logger

## Files to Modify

**src/ (renderer) -- 17 files:**
- `src/appCore/state/machine/LoadingOrchestrator.tsx` (24 replacements)
- `src/hooks/useIPhoneSync.ts` (14 replacements)
- `src/services/SyncOrchestratorService.ts` (14 replacements)
- `src/components/onboarding/steps/PermissionsStep.tsx` (7 replacements)
- `src/appCore/state/machine/debug.ts` (5 replacements + DEBUG_ENABLED change)
- `src/appCore/state/flows/usePhoneTypeApi.ts` (2 replacements)
- `src/hooks/useTransactionStatusUpdate.ts` (1)
- `src/components/onboarding/OnboardingFlow.tsx` (1)
- `src/components/Login.tsx` (1)
- `src/components/onboarding/hooks/useOnboardingFlow.ts` (1)
- `src/components/onboarding/steps/index.ts` (1)
- `src/components/onboarding/steps/DataSyncStep.tsx` (1)
- `src/components/onboarding/steps/AccountVerificationStep.tsx` (1)
- `src/components/onboarding/steps/SecureStorageStep.tsx` (1)
- `src/appCore/state/machine/selectors/userDataSelectors.ts` (1)
- `src/appCore/state/flows/useSecureStorage.ts` (1)
- `src/appCore/state/flows/useAuthFlow.ts` (1)

**electron/ (main process) -- 2 files:**
- `electron/services/databaseService.ts` (2 console.log + 1 console.warn)
- `electron/main.ts` (1 console.log)

## Files to Read (for context)

- `electron/services/logService.ts` - Existing structured logger for main process
- `src/appCore/state/machine/debug.ts` - Debug utility with styled console output

---

## Testing Expectations

### Unit Tests
- **Required:** No (logging replacement does not change behavior)
- **New tests to write:** None
- **Existing tests to update:** None (tests use their own console.log, which we skip)

### CI Requirements
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `chore: replace 83 console.log calls with structured logging`
- **Branch:** `chore/task-2008-replace-console-log`
- **Target:** `develop`

---

## PM Status Updates

PM updates ALL three locations at each transition (engineer does NOT update status):

| When | Status | Where |
|------|--------|-------|
| Engineer assigned | → `In Progress` | backlog.csv + BACKLOG-XXX.md (if exists) + SPRINT-087.md |
| PR created + CI passes | → `Testing` | backlog.csv + BACKLOG-XXX.md (if exists) + SPRINT-087.md |
| PR merged | → `Completed` | backlog.csv + BACKLOG-XXX.md (if exists) + SPRINT-087.md |

**Backlog IDs to update:** BACKLOG-726

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
- [ ] src/utils/logger.ts created
- [ ] All src/ console.log replaced (77 occurrences in 17 files)
- [ ] All electron/ console.log replaced (3 occurrences in 2 files)
- [ ] debug.ts updated with NODE_ENV check
- [ ] Verification grep shows zero production console.log
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)
- [ ] Tests pass (npm test)

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
- **Actual Tokens**: ~XK (Est: ~8K)
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- You find console.log calls in significantly more files than listed (>25 production files)
- The existing logService API does not support the patterns used (e.g., formatted objects)
- Replacing console.log causes test failures (tests may mock console)
- You discover console.warn or console.error calls in files NOT already being modified (those are out of scope)
- LoadingOrchestrator uses console.log for timing-critical debug output that logger overhead could affect
