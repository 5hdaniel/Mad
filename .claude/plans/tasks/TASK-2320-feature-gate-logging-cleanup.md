# TASK-2320: Feature Gate Logging Cleanup

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/skills/agent-handoff/SKILL.md` for full workflow.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Downgrade warn-level log messages in `featureGateHandlers.ts` and `featureGateService.ts` to info or debug for normal operational flow. Keep warn level only for actual warning conditions (no session, RPC failures). This was a recommendation from SR Engineer review of PR #1400.

## Non-Goals

- Do NOT change any feature gate logic or behavior
- Do NOT add new log messages (only change levels of existing ones)
- Do NOT modify the cache invalidation handler (already uses debug)
- Do NOT change error-level logs (if any exist)

## Deliverables

1. Update: `electron/handlers/featureGateHandlers.ts` -- Change log levels
2. Update: `electron/services/featureGateService.ts` -- Change log levels

## File Boundaries

### Files to modify (owned by this task):
- `electron/handlers/featureGateHandlers.ts`
- `electron/services/featureGateService.ts`

### Files this task must NOT modify:
- Any other handler or service files
- `electron/services/__tests__/featureGateService.test.ts` -- Unless tests assert specific log levels

## Context

### Current State of `featureGateHandlers.ts`

Almost all log calls use `logService.warn()`, even for normal operations:
- Line 25-29: `logService.warn("[FeatureGate] No active session...")` -- **KEEP as warn** (this is a real warning)
- Line 32-36: `logService.warn("[FeatureGate] Resolving org for user")` -- **Change to debug** (normal flow)
- Line 43-47: `logService.warn("[FeatureGate] Org resolved successfully")` -- **Change to debug** (normal flow)
- Line 49-53: `logService.warn("[FeatureGate] No org membership found...")` -- **Change to info** (informational, not a warning)
- Line 70-73: `logService.warn("[FeatureGate] Checking feature")` -- **Change to debug** (normal flow)
- Line 103-105: `logService.warn("[FeatureGate] Getting all features")` -- **Change to debug** (normal flow)

### Current State of `featureGateService.ts`

Many warn-level logs for normal cache operations. Apply the same principle:
- **Keep as warn:** RPC failures, unexpected errors, no session
- **Change to info:** Cache miss (first load), feature not found in cache
- **Change to debug:** Cache hit, cache refresh, normal operational flow

### Guideline

| Condition | Log Level |
|-----------|-----------|
| No session / auth failure | `warn` |
| RPC call failed | `warn` |
| Unexpected/unhandled error | `warn` or `error` |
| Cache miss, first load | `info` |
| No org membership (individual user) | `info` |
| Normal feature check | `debug` |
| Cache hit, refresh | `debug` |
| Org resolved successfully | `debug` |
| Handler registered | `debug` |

## Acceptance Criteria

- [ ] `featureGateHandlers.ts` -- warn-level logs changed per the guideline above
- [ ] `featureGateService.ts` -- warn-level logs changed per the guideline above
- [ ] No behavioral changes to feature gate logic
- [ ] `logService.warn` only used for actual warning conditions
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes (including featureGateService tests)

## Do / Don't

### Do:
- Audit every `logService.warn` call in both files
- Apply the log level guideline consistently
- Preserve log message text (only change the method name)

### Don't:
- Change log message content or parameters
- Add new log statements
- Change any non-logging code
- Remove any log statements

## When to Stop and Ask

- If tests explicitly assert log levels and would break
- If you are unsure whether a specific log is "normal flow" or "actual warning"

## Testing Expectations

### Unit Tests
- Required: No new tests (log level changes only)
- Existing: Run `featureGateService.test.ts` to verify nothing breaks

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## PR Preparation

- **Title:** `fix: downgrade feature gate logs from warn to info/debug for normal flow (BACKLOG-1351)`
- **Branch:** `fix/task-2320-feature-gate-logging`
- **Target:** `int/identity-provisioning`

---

## PM Estimate (PM-Owned)

**Category:** `cleanup`

**Estimated Tokens:** ~5K (cleanup x 0.5 = ~5K from base ~10K)

**Token Cap:** 20K (4x upper estimate)

> If you reach this cap, STOP and report to PM.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 2 files | +2K |
| Code volume | ~15 log level changes | +2K |
| Test complexity | None | +0K |
| Exploration | Verify test compatibility | +1K |

**Confidence:** High

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files modified:
- [ ] electron/handlers/featureGateHandlers.ts
- [ ] electron/services/featureGateService.ts

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Notes

**Deviations from plan:** None

**Issues encountered:** [Document any challenges]

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Test Coverage:** N/A (log level changes only)

### Merge Information

**PR Number:** #XXX
**Merged To:** int/identity-provisioning
