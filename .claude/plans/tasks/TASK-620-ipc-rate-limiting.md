# TASK-620: IPC Rate Limiting for Expensive Handlers

**Backlog ID:** BACKLOG-102 (Deferred Phase 2 from TASK-619)
**Sprint:** SPRINT-009 - Codebase Standards Remediation
**Phase:** 6 - Type Safety (Security)
**Branch:** `feature/TASK-620-ipc-rate-limiting`
**Estimated Turns:** 6-8
**Estimated Tokens:** ~30K
**Depends On:** TASK-611 (SQL Field Whitelist), TASK-616/617 (if modifying same handler files)
**Source:** BACKLOG-102 (Phase 2 - deferred from TASK-619)

---

## Objective

Implement IPC rate limiting for expensive handlers to prevent DoS attacks via rapid repeated IPC calls. This completes the security hardening work started in TASK-619.

---

## Context

TASK-619 implemented:
- Phase 1: SQL Query Timeout (busy_timeout pragma) - DONE
- Phase 3: Security Documentation - DONE

This task implements the deferred Phase 2: IPC Rate Limiting.

The codebase currently has no protection against rapid repeated IPC calls. A malicious renderer process (or compromised code) could spam expensive handlers, causing resource exhaustion.

---

## Requirements

### Must Do:

1. **Create throttle/debounce utility** - `electron/utils/rateLimit.ts`
   - Implement `throttle()` function for rate limiting
   - Implement `debounce()` function for delayed execution
   - TypeScript-safe with proper generics

2. **Identify expensive IPC handlers** - Analyze `electron/handlers/` for:
   - File system operations (scan, read, write)
   - Database-heavy queries (full table scans, complex joins)
   - External API calls (OAuth, email sync)
   - Backup/restore operations

3. **Apply rate limiting to at least 3 expensive handlers**
   - Choose handlers with highest DoS potential
   - Use generous thresholds (don't break legitimate use)
   - Document rationale for chosen thresholds

4. **Write tests** - `electron/utils/__tests__/rateLimit.test.ts`
   - Test throttle behavior
   - Test debounce behavior
   - Test edge cases (rapid calls, timeout)

### Must NOT Do:

- Break existing handler functionality
- Apply rate limiting to cheap/fast handlers
- Use overly aggressive thresholds that affect normal use
- Add unnecessary dependencies (use native implementations)

### Optional (Skip unless needed):

- DOMPurify integration (only if user-generated HTML rendering is planned)

---

## Implementation Details

### Phase 1: Create Rate Limit Utility (~15 min)

```typescript
// electron/utils/rateLimit.ts

/**
 * Throttle function - limits execution to at most once per delay period.
 * Returns the last result if called during cooldown.
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  let lastCall = 0;
  let lastResult: ReturnType<T> | undefined;

  return (...args: Parameters<T>): ReturnType<T> | undefined => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      lastResult = fn(...args) as ReturnType<T>;
      return lastResult;
    }
    return lastResult;
  };
}

/**
 * Debounce function - delays execution until no calls for delay period.
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}
```

### Phase 2: Identify and Apply to Handlers (~30 min)

**Target handlers to investigate:**
- `electron/handlers/fileHandlers.ts` - file operations
- `electron/handlers/databaseHandlers.ts` - database queries
- `electron/handlers/syncHandlers.ts` - sync operations
- `electron/handlers/backupHandlers.ts` - backup/restore

**Recommended thresholds:**
| Handler Type | Threshold | Rationale |
|--------------|-----------|-----------|
| File scan | 5 seconds | Prevents rapid re-scans |
| Backup create | 30 seconds | Prevents backup spam |
| Full DB export | 10 seconds | Prevents export spam |

### Phase 3: Write Tests (~15 min)

Test cases:
1. Throttle allows first call immediately
2. Throttle blocks calls within cooldown period
3. Throttle allows call after cooldown expires
4. Debounce delays execution
5. Debounce resets timer on subsequent calls
6. Edge case: zero delay
7. Edge case: very rapid calls

---

## Acceptance Criteria

- [ ] `electron/utils/rateLimit.ts` created with throttle and debounce functions
- [ ] `electron/utils/__tests__/rateLimit.test.ts` created with comprehensive tests
- [ ] At least 3 expensive IPC handlers have rate limiting applied
- [ ] Rate limiting thresholds documented in code comments
- [ ] All existing tests pass
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] No regressions in handler functionality

---

## Files to Create

| File | Purpose |
|------|---------|
| `electron/utils/rateLimit.ts` | Throttle/debounce utilities |
| `electron/utils/__tests__/rateLimit.test.ts` | Unit tests |

## Files to Modify

| File | Change |
|------|--------|
| `electron/handlers/*.ts` | Add rate limiting to expensive handlers |

## Files to Read (for context)

| File | Why |
|------|-----|
| `electron/handlers/` | Understand current handler structure |
| `.claude/docs/shared/security-patterns.md` | Existing security documentation from TASK-619 |
| `electron/utils/sqlFieldWhitelist.ts` | Reference for utility pattern (from TASK-611) |

---

## Testing Expectations

### Unit Tests
- **Required:** Yes
- **New tests to write:** `rateLimit.test.ts` (throttle/debounce behavior)
- **Existing tests to update:** None expected

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `feat(security): add IPC rate limiting for expensive handlers`
- **Branch:** `feature/TASK-620-ipc-rate-limiting`
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
- [ ] Rate limit utility created
- [ ] Tests written and passing
- [ ] At least 3 handlers rate-limited
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

- **Before**: No IPC rate limiting
- **After**: 3+ expensive handlers protected
- **Actual Turns**: X (Est: 6-8)
- **Actual Tokens**: ~XK (Est: ~30K)
- **Actual Time**: X min
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- Handler files have been significantly modified by other tasks (TASK-616/617)
- Rate limiting seems to break legitimate use cases
- Unclear which handlers are "expensive enough" to rate limit
- You encounter blockers not covered in the task file

---

## Parallel Execution Notes

**Can run in parallel with:** TASK-614, TASK-613, TASK-615
**Must wait for:** TASK-616/617 if they modify the same handler files

**Recommended approach:**
- Check if TASK-616/617 are complete before starting
- If not, coordinate with PM on file conflicts
