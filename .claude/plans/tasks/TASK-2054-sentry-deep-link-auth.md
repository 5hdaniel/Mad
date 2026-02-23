# Task TASK-2054: Sentry Logging for Deep Link Auth Failures

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

Add Sentry error tracking to the deep link authentication callback handler in `electron/main.ts`. Currently, auth failures via the `magicaudit://` protocol are logged locally but NOT reported to Sentry, meaning production auth issues go untracked.

## Non-Goals

- Do NOT refactor the deep link handler logic
- Do NOT change the auth flow behavior
- Do NOT add Sentry to non-auth deep link paths

## Prerequisites

**Sprint:** SPRINT-094
**Depends on:** Nothing (standalone fix)

## Deliverables

1. **Update:** `electron/main.ts` — Add `Sentry.captureException` calls to all error paths in `handleDeepLinkCallback`

## Acceptance Criteria

- [ ] All `catch` blocks and error paths in `handleDeepLinkCallback()` call `Sentry.captureException` with appropriate tags
- [ ] Tags include: `component: "deep-link"`, `action: "auth-callback"`
- [ ] The `UNKNOWN_ERROR` catch-all at ~line 545-552 includes Sentry logging
- [ ] License-blocked and device-limit error paths also log to Sentry (these are important operational signals)
- [ ] No sensitive data (tokens, codes) sent to Sentry — the `redactDeepLinkUrl` function should be used if URL is included
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Implementation Notes

### Error paths in `handleDeepLinkCallback` to instrument:

1. **Line ~331**: `auth:deep-link-error` — missing/invalid tokens
2. **Line ~350**: `auth:deep-link-error` — Supabase session set failure
3. **Line ~373**: `auth:deep-link-license-blocked` — license validation failed
4. **Line ~390**: `auth:deep-link-device-limit` — device limit exceeded
5. **Line ~548**: `auth:deep-link-error` — catch-all UNKNOWN_ERROR

### Pattern to follow (from `sessionHandlers.ts`):

```typescript
import * as Sentry from "@sentry/electron/main";

// In each error path:
Sentry.captureException(error, {
  tags: { component: "deep-link", action: "auth-callback" },
  extra: { code: "UNKNOWN_ERROR" },  // or appropriate error code
});
```

### Key Files

- `electron/main.ts` — The `handleDeepLinkCallback` function (~line 295-553)
- `electron/handlers/sessionHandlers.ts` — Reference for Sentry pattern already used

## Do / Don't

### Do:
- Follow the exact Sentry pattern used in `sessionHandlers.ts`
- Include meaningful tags and error codes
- Use `redactDeepLinkUrl` before including any URL info in Sentry extras

### Don't:
- Send raw tokens or auth codes to Sentry
- Change the existing error handling behavior (still send events to renderer)
- Add Sentry to non-error code paths

## Testing Expectations (MANDATORY)

### Unit Tests
- Not strictly required for this change (adding logging to existing error paths)
- If practical, add a test verifying `Sentry.captureException` is called on error

### CI Requirements
- [ ] Type checking passes
- [ ] Lint passes
- [ ] Tests pass

## PR Preparation

- **Title**: `fix(telemetry): add Sentry logging to deep link auth failures`
- **Labels**: `bug`, `security`, `telemetry`

---

## PM Estimate (PM-Owned)

**Category:** `fix`
**Estimated Tokens:** ~15K
**Token Cap:** 60K (4x)
