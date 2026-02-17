# TASK-2002: Create wrapHandler() HOF for Error Handling Boilerplate

**Backlog:** BACKLOG-718
**Sprint:** SPRINT-085
**Status:** Pending
**Priority:** High
**Category:** refactor
**Estimated Tokens:** ~15K (refactor x0.5 multiplier applied)
**Token Cap:** ~60K (4x)

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See CLAUDE.md for the full 15-step workflow.

---

## Goal

Create a `wrapHandler()` higher-order function that eliminates the duplicated error-handling boilerplate found 179 times across handler files. The pattern `error instanceof Error ? error.message : "Unknown error"` and the `ValidationError` catch block (30+ times) should be handled by a single utility. This task creates the utility and its tests -- it does NOT apply it to existing handlers (that happens during TASK-1999 and TASK-2004 when those files are being rewritten).

## Non-Goals

- Do NOT apply `wrapHandler()` to existing handler files in this task -- the handler split tasks (TASK-1999, TASK-2004) will adopt it during their refactoring
- Do NOT change any existing handler behavior
- Do NOT create a generic middleware system -- keep it simple and focused
- Do NOT add logging or metrics to the wrapper (handlers already have their own logging)

## Deliverables

### New Files to Create

| File | Purpose |
|------|---------|
| `electron/utils/wrapHandler.ts` | The HOF utility |
| `electron/utils/__tests__/wrapHandler.test.ts` | Comprehensive unit tests |

## Implementation Notes

### Current Pattern (repeated 179 times)

```typescript
ipcMain.handle("some:channel", async (event, ...args) => {
  try {
    // ... validation and business logic ...
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof ValidationError) {
      return { success: false, error: error.message };
    }
    logService.error("Handler failed", "Module", { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
});
```

### Target Pattern (with wrapHandler)

```typescript
ipcMain.handle("some:channel", wrapHandler(async (event, ...args) => {
  // ... validation and business logic ...
  return { success: true, data: result };
}));
```

### wrapHandler Implementation

```typescript
// electron/utils/wrapHandler.ts
import type { IpcMainInvokeEvent } from "electron";
import { ValidationError } from "./validation";
import logService from "../services/logService";

/**
 * Wraps an IPC handler function with standardized error handling.
 *
 * - ValidationError -> { success: false, error: message }
 * - Error -> { success: false, error: message }
 * - Unknown -> { success: false, error: "Unknown error" }
 *
 * The wrapped handler should throw on error and return success responses directly.
 * The wrapper catches all errors and formats them consistently.
 */
export function wrapHandler<T extends (...args: [IpcMainInvokeEvent, ...unknown[]]) => Promise<unknown>>(
  handler: T,
  options?: {
    /** Module name for error logging (defaults to "IPC") */
    module?: string;
  }
): T {
  const wrappedHandler = async (event: IpcMainInvokeEvent, ...args: unknown[]) => {
    try {
      return await handler(event, ...args);
    } catch (error) {
      if (error instanceof ValidationError) {
        return { success: false, error: error.message };
      }
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logService.error(
        `Handler error: ${errorMessage}`,
        options?.module ?? "IPC",
        { error }
      );
      return { success: false, error: errorMessage };
    }
  };
  return wrappedHandler as T;
}
```

### CRITICAL: Response Shape Compatibility

The wrapper MUST produce identical error response shapes to what exists today. Specifically:

| Error Type | Response | Must Match |
|------------|----------|------------|
| `ValidationError` | `{ success: false, error: "validation message" }` | Exact |
| `Error` | `{ success: false, error: "error.message" }` | Exact |
| Non-Error throw | `{ success: false, error: "Unknown error" }` | Exact |

Some handlers have custom error properties (like `error.code`). The wrapper should NOT strip these -- but since we're only returning `error.message`, this is already the existing behavior.

### Design Decision: Logging

The current handlers inconsistently log errors -- some use `logService.error()`, some use `console.error()`, some don't log at all. The wrapper should log ALL errors via `logService.error()` for consistency. This is a minor behavior enhancement but a safe one (adding logging never breaks callers).

The `module` option allows handler files to identify themselves:

```typescript
// In emailSyncHandlers.ts
ipcMain.handle("transactions:sync-and-fetch-emails",
  wrapHandler(async (event, userId, transactionId) => {
    // ...
  }, { module: "EmailSync" })
);
```

## Acceptance Criteria

- [ ] `electron/utils/wrapHandler.ts` exists with the `wrapHandler()` function
- [ ] Function handles `ValidationError`, `Error`, and non-Error throws
- [ ] Error response shape is `{ success: false, error: string }` in all cases
- [ ] Function accepts optional `module` parameter for logging context
- [ ] Unit tests cover all 4 cases: success, ValidationError, Error, non-Error throw
- [ ] Unit tests verify exact response shapes match the existing pattern
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Test Cases (Required)

The test file MUST cover these scenarios:

```typescript
describe("wrapHandler", () => {
  it("passes through successful handler response unchanged");
  it("catches ValidationError and returns { success: false, error: message }");
  it("catches Error and returns { success: false, error: message }");
  it("catches non-Error throw and returns { success: false, error: 'Unknown error' }");
  it("logs errors via logService.error");
  it("does not log ValidationError via logService.error"); // ValidationErrors are expected, not bugs
  it("uses custom module name when provided");
  it("preserves handler this-context and arguments");
});
```

**Note on ValidationError logging:** Review the existing pattern -- some handlers log ValidationErrors, some don't. The most common pattern is to NOT log ValidationErrors (they are expected input failures, not bugs). The wrapper should follow the majority pattern.

## Do / Don't Guidelines

### DO:
- Keep the function simple -- it is a thin wrapper, not a framework
- Use the existing `ValidationError` class from `electron/utils/validation.ts`
- Use the existing `logService` for error logging
- Write comprehensive tests with exact response shape assertions

### DON'T:
- Add middleware chaining
- Add request/response transformation
- Add rate limiting or caching
- Add custom error classes beyond what already exists
- Over-engineer the types -- keep it practical

## Stop-and-Ask Triggers

- If `ValidationError` is not importable from `electron/utils/validation.ts`, ask about its location
- If `logService` is not importable, ask about logging approach
- If the handler type signature doesn't work with `ipcMain.handle()`, ask for guidance

## Testing Expectations

- Comprehensive unit tests as specified above (8 test cases minimum)
- Mock `logService.error` to verify logging behavior
- Mock `ValidationError` or import the real one

## PR Preparation

**Title:** `refactor: create wrapHandler() HOF for IPC error handling`
**Labels:** refactor, architecture
**Base:** develop

---

## Implementation Summary

| Field | Value |
|-------|-------|
| **Agent ID** | engineer-task-2002 |
| **Branch** | refactor/task-2002-wrap-handler-hof |
| **PR** | TBD |
| **Files Changed** | 2 (1 new source, 1 new test) |
| **Tests Added** | 13 test cases in wrapHandler.test.ts |
| **Issues/Blockers** | None |

### Changes Made

1. **`electron/utils/wrapHandler.ts`** - New HOF utility that wraps IPC handlers with standardized error handling. Handles ValidationError (no logging), Error, and non-Error throws. Optional `module` parameter for logging context.
2. **`electron/utils/__tests__/wrapHandler.test.ts`** - 13 test cases covering: success passthrough, ValidationError handling, Error handling, non-Error throws (string and number), logging behavior, custom module name, default module name, argument preservation, non-object return values, undefined return, and null throw logging.

### Verification Results

- type-check: PASS
- lint (new files): PASS (pre-existing lint error in ContactFormModal.tsx is unrelated)
- tests: 13/13 PASS
