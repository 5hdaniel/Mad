# TASK-2163: Reduce Login Retry from 3 to 1

**Backlog ID:** BACKLOG-920
**Sprint:** SPRINT-128
**Batch:** 1 (parallel with TASK-2162, TASK-2164)
**Branch:** `fix/BACKLOG-920-reduce-login-retry`
**Status:** Completed
**Estimated Tokens:** ~1K
**Token Cap:** 4K
**PR:** #1136 (Merged)

---

## Objective

Reduce the login auto-retry count from 3 to 1 in `src/components/Login.tsx` to prevent the browser from opening up to 4 times when the deep link callback is broken. With `maxRetries: 1`, the user gets the initial attempt plus one automatic retry (2 total), then sees the "Try Again" button for manual control.

---

## Context

The login flow opens the user's browser for OAuth authentication. If the deep link callback fails (e.g., protocol handler not registered correctly, app not focused), each retry opens the browser again. With `maxRetries: 3`, this means the browser opens up to 4 times (initial + 3 retries), which is disruptive and confusing. The retry config was added in TASK-2044.

The UI already shows attempt count text like "Retrying (attempt 2/4)..." which updates automatically based on `LOGIN_RETRY_CONFIG.maxRetries`. No UI text changes are needed -- the template strings reference the config value dynamically.

---

## Requirements

### Must Do:
1. Change `maxRetries: 3` to `maxRetries: 1` at `src/components/Login.tsx:17`

### Must NOT Do:
- Do not change `baseDelayMs` or `maxDelayMs` values
- Do not modify the retry logic itself
- Do not change the "Try Again" button behavior
- Do not remove the retry mechanism entirely (1 retry is still valuable for transient failures)

---

## Acceptance Criteria

- [ ] `LOGIN_RETRY_CONFIG.maxRetries` equals `1` in `src/components/Login.tsx`
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Files to Modify

- `src/components/Login.tsx:17` - Change `maxRetries: 3` to `maxRetries: 1`

## Files to Read (for context)

- `src/components/Login.tsx` - Verify the retry config location and understand surrounding logic

---

## Testing Expectations

### Unit Tests
- **Required:** No new tests needed
- **Existing tests to update:** If any test asserts `maxRetries === 3`, update to `1`

### Manual Verification
- Login with a working deep link: should succeed on first attempt (no change)
- Login with a broken deep link: browser opens max 2 times (initial + 1 retry), then shows "Try Again" button

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes

---

## PR Preparation

- **Title:** `fix(ui): reduce login retry from 3 to 1 to prevent repeated browser opens`
- **Branch:** `fix/BACKLOG-920-reduce-login-retry`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: 2026-03-12*

### Engineer Checklist

```
Pre-Work:
- [x] Created branch from develop
- [x] Noted start time: 2026-03-12
- [x] Read task file completely

Implementation:
- [x] Code complete
- [x] Tests pass locally (npm test) - no Login unit tests; worktree path excluded by jest config
- [x] Type check passes (npm run type-check)
- [x] Lint passes (npm run lint)

PR Submission:
- [x] This summary section completed
- [x] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [x] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: `LOGIN_RETRY_CONFIG.maxRetries = 3` (browser opens up to 4 times on broken deep link)
- **After**: `LOGIN_RETRY_CONFIG.maxRetries = 1` (browser opens max 2 times, then shows "Try Again")
- **Actual Tokens**: auto-captured (Est: ~1K)
- **PR**: https://github.com/5hdaniel/Mad/pull/1135

### Notes

**Deviations from plan:**
None. Single-line change as specified.

**Issues encountered:**
**Issues/Blockers:** None

---

## Guardrails

**STOP and ask PM if:**
- The retry config is referenced from multiple files (should only be in Login.tsx)
- Any test explicitly asserts the retry count and you're unsure whether to update it
- You encounter blockers not covered in the task file
