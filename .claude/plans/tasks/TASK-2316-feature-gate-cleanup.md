# TASK-2316: Feature Gate Logging Cleanup + Constant Extraction

**Backlog IDs:** BACKLOG-1351, BACKLOG-1352
**Sprint:** SPRINT-P
**Branch:** `fix/task-2316-feature-gate-cleanup`
**Branch From:** `develop`
**Branch Into:** `develop`
**Estimated Tokens:** ~12K (chore x0.5 = ~6K effective, but two items combined)
**Status:** Pending

---

## Objective

Clean up the feature gate code in two ways:
1. Downgrade `logService.warn()` calls to `logService.info()` or `logService.debug()` for normal operational flow. Keep `warn` only for actual warning conditions (no session found, RPC failures).
2. Extract the duplicated team features deny list array to a shared constant at the top of `featureGateHandlers.ts`.

Both items are SR Engineer recommendations from PR #1400 review.

---

## Context

- `featureGateHandlers.ts` has 6 `logService.warn()` calls for normal operations (org resolution, feature checking) that should be `info` or `debug`
- `featureGateService.ts` has 14 `logService.warn()` calls, many of which are normal operational logs
- The team features deny list `["broker_submission", "ai_detection", "broker_email_view", "broker_email_attachments"]` appears in two places in `featureGateHandlers.ts` (lines 74-78 and lines 107-111)

---

## Requirements

### Part 1: Logging Cleanup (BACKLOG-1351)

**In `featureGateHandlers.ts`:**
1. Line 27 (`No active Supabase session`) -- KEEP as `warn` (this is an actual warning)
2. Line 34 (`Resolving org for user`) -- Change to `debug`
3. Line 44 (`Org resolution result`) -- Change to `debug`
4. Line 64 (`Checking feature`) -- Change to `debug`
5. Line 97 (`Getting all features`) -- Change to `debug`

**In `featureGateService.ts`:**
6. Review all 14 `logService.warn()` calls and downgrade:
   - Normal cache operations (hit, miss, invalidate) -> `debug`
   - Normal RPC calls and responses -> `info`
   - Actual failures (RPC errors, invalid data) -> KEEP as `warn`
   - `No active session` -> KEEP as `warn`

### Part 2: Constant Extraction (BACKLOG-1352)

7. At the top of `featureGateHandlers.ts` (after imports), add:
```typescript
/**
 * Features that require team/enterprise plans.
 * Individual users without an org are denied these features.
 * Used in both feature-gate:check and feature-gate:get-all handlers.
 */
const TEAM_ONLY_FEATURES = [
  "broker_submission",
  "ai_detection",
  "broker_email_view",
  "broker_email_attachments",
] as const;
```
8. Replace the inline array at line 74-78 with `TEAM_ONLY_FEATURES.includes(featureKey as typeof TEAM_ONLY_FEATURES[number])`
9. Replace the inline object at lines 107-111 with a computed version using `TEAM_ONLY_FEATURES`

### Must NOT Do:
- Do NOT change any business logic -- only log levels and constant extraction
- Do NOT add or remove any log statements
- Do NOT modify the `registerFeatureGateHandlers` function signature
- Do NOT touch `featureGateService.test.ts` unless tests explicitly assert on log levels

---

## Acceptance Criteria

- [ ] No `logService.warn()` calls remain for normal operational flow in `featureGateHandlers.ts`
- [ ] No `logService.warn()` calls remain for normal operational flow in `featureGateService.ts`
- [ ] `logService.warn()` is ONLY used for actual warnings (no session, RPC failures, invalid data)
- [ ] `TEAM_ONLY_FEATURES` constant exists at the top of `featureGateHandlers.ts`
- [ ] Both `feature-gate:check` and `feature-gate:get-all` handlers use the constant
- [ ] No inline duplicate deny list arrays remain
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes (existing tests should still pass)

---

## Files to Modify

- `electron/handlers/featureGateHandlers.ts` -- Log level changes + constant extraction
- `electron/services/featureGateService.ts` -- Log level changes

## Files to Read (for context)

- `electron/services/__tests__/featureGateService.test.ts` -- Check if tests assert on log levels

---

## Testing Expectations

### Unit Tests
- **Required:** No new tests needed
- **Existing tests:** Verify `featureGateService.test.ts` still passes (if it mocks `logService.warn`, it may need updating to `logService.debug` or `logService.info`)

### Manual Testing
- Open the desktop app, verify no warn-level spam in the console for normal feature gate operations
- Verify feature gate still works (team features denied for individual users, allowed for org users)

### CI Requirements
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## PR Preparation

- **Title:** `chore: clean up feature gate logging levels and extract deny list constant (BACKLOG-1351, BACKLOG-1352)`
- **Branch:** `fix/task-2316-feature-gate-cleanup`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Read task file completely

Implementation:
- [ ] Log levels updated in featureGateHandlers.ts
- [ ] Log levels updated in featureGateService.ts
- [ ] TEAM_ONLY_FEATURES constant created
- [ ] Both handlers use the constant
- [ ] Type check passes
- [ ] Lint passes
- [ ] Tests pass

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics
- [ ] CI passes
- [ ] SR Engineer review requested
```

### Results

- **Before**: Warn-level logs for normal operations; duplicated deny list
- **After**: Appropriate log levels; single constant for deny list
- **Actual Tokens**: ~XK (Est: 12K)
- **PR**: [URL after PR created]

---

## Guardrails

**STOP and ask PM if:**
- Tests explicitly assert on `logService.warn` being called for the lines you're changing
- The log level change would break any monitoring/alerting that watches for warn-level logs
- You find additional duplicate constants that should also be extracted
