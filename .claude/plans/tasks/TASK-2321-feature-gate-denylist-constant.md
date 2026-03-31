# TASK-2321: Extract Team Features Deny List to Constant

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/skills/agent-handoff/SKILL.md` for full workflow.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Extract the duplicated team features deny list in `featureGateHandlers.ts` to a shared constant. The list currently appears in two places: the `feature-gate:check` handler and the `feature-gate:get-all` handler. This was a recommendation from SR Engineer review of PR #1400.

## Non-Goals

- Do NOT change any feature gate logic or behavior
- Do NOT move the constant to a separate file (keep it in featureGateHandlers.ts)
- Do NOT modify featureGateService.ts (that was TASK-2320's scope)
- Do NOT add or remove features from the deny list

## Deliverables

1. Update: `electron/handlers/featureGateHandlers.ts` -- Extract constant, reference it in both handlers

## File Boundaries

### Files to modify (owned by this task):
- `electron/handlers/featureGateHandlers.ts`

### Files this task must NOT modify:
- `electron/services/featureGateService.ts` -- Already modified by TASK-2320
- Any other files

### Dependencies:
- **MUST run after TASK-2320** (both modify `featureGateHandlers.ts`)

## Context

### Current Duplication

**Location 1 -- `feature-gate:check` handler (lines 80-85):**
```typescript
const teamFeatures = [
  "broker_submission",
  "ai_detection",
  "broker_email_view",
  "broker_email_attachments",
];
```

**Location 2 -- `feature-gate:get-all` handler (lines 113-118):**
```typescript
return {
  broker_submission: { allowed: false, value: "", source: "default" as const },
  ai_detection: { allowed: false, value: "", source: "default" as const },
  broker_email_view: { allowed: false, value: "", source: "default" as const },
  broker_email_attachments: { allowed: false, value: "", source: "default" as const },
};
```

### Target

Extract to a module-level constant and use it in both locations:

```typescript
/** Features that require team/enterprise org membership.
 *  Individual users (no org) are denied these features. */
const TEAM_ONLY_FEATURES = [
  "broker_submission",
  "ai_detection",
  "broker_email_view",
  "broker_email_attachments",
] as const;
```

Then derive the deny-all record in `get-all` from the constant:

```typescript
const denyAll: Record<string, FeatureAccess> = {};
for (const key of TEAM_ONLY_FEATURES) {
  denyAll[key] = { allowed: false, value: "", source: "default" };
}
return denyAll;
```

Or use `Object.fromEntries`:
```typescript
return Object.fromEntries(
  TEAM_ONLY_FEATURES.map(key => [key, { allowed: false, value: "", source: "default" as const }])
);
```

## Acceptance Criteria

- [ ] `TEAM_ONLY_FEATURES` (or similar) constant defined once at module level
- [ ] `feature-gate:check` handler references the constant instead of inline array
- [ ] `feature-gate:get-all` handler derives deny record from the constant
- [ ] No behavioral change -- same features are denied for individual users
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Do / Don't

### Do:
- Use `as const` on the array for type safety
- Add a JSDoc comment explaining what the constant is for
- Keep the constant in the same file (module-level, not exported)

### Don't:
- Add or remove features from the list
- Export the constant (it is internal to this handler file)
- Change the handler registration structure

## When to Stop and Ask

- If TASK-2320 has not been merged yet (this task depends on it)
- If the file structure has changed significantly from what is described

## Testing Expectations

### Unit Tests
- Required: No (refactor, same behavior)

### Manual Testing
- Verify feature gate check still works for individual users (denied team features)
- Verify feature gate get-all still returns deny records for team features

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## PR Preparation

- **Title:** `refactor: extract team features deny list to constant in featureGateHandlers (BACKLOG-1352)`
- **Branch:** `fix/task-2321-feature-gate-denylist-constant`
- **Target:** `int/identity-provisioning`
- **Depends on:** TASK-2320 (must be merged first)

---

## PM Estimate (PM-Owned)

**Category:** `refactor`

**Estimated Tokens:** ~3K (refactor x 0.5 = ~3K from base ~6K)

**Token Cap:** 12K (4x upper estimate)

> If you reach this cap, STOP and report to PM.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 1 file | +1K |
| Code volume | ~10 lines changed | +1K |
| Test complexity | None | +0K |
| Exploration | Minimal (clear task) | +1K |

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
**Test Coverage:** N/A (refactor)

### Merge Information

**PR Number:** #XXX
**Merged To:** int/identity-provisioning
