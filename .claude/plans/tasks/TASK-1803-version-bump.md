# Task TASK-1803: Version Bump to 2.0.7

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See TASK-1800 for full workflow description.

---

## Goal

Bump the application version from 2.0.6 to 2.0.7 in preparation for the release containing the critical onboarding fixes.

## Non-Goals

- Do NOT change any functionality
- Do NOT update changelog (separate process)
- Do NOT trigger the release workflow (that's TASK-1804)

## Deliverables

1. Update: `package.json` - Bump version to 2.0.7

## Acceptance Criteria

- [ ] `package.json` version is "2.0.7"
- [ ] No other changes in the PR
- [ ] All CI checks pass

## Implementation Notes

### Simple Change

```json
// package.json
{
  "name": "magic-audit",
  "version": "2.0.7",  // Changed from 2.0.6
  ...
}
```

### Verify After Change

```bash
npm version  # Should show 2.0.7
```

## Integration Notes

- Imports from: None
- Exports to: None
- Used by: Build system, release workflow
- Depends on: TASK-1800 and TASK-1802 must be merged first

## Do / Don't

### Do:
- Only change the version number
- Verify no other changes included

### Don't:
- Update package-lock.json manually (let npm do it if needed)
- Change anything else
- Include unrelated changes

## When to Stop and Ask

- If version is not 2.0.6 as expected
- If there are uncommitted changes in package.json

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (config change only)

### CI Requirements

This task's PR MUST pass:
- [x] Type checking
- [x] Lint / format checks
- [x] Build step

## PR Preparation

- **Title**: `chore: bump version to 2.0.7 for critical onboarding fixes`
- **Labels**: `release`, `chore`
- **Base Branch**: `main`
- **Depends on**: TASK-1800, TASK-1802

---

## PM Estimate (PM-Owned)

**Category:** `config`

**Estimated Tokens:** ~2K-3K

**Token Cap:** 12K (4x upper estimate)

**Confidence:** Very High (trivial change)

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files updated:
- [ ] package.json (version: 2.0.7)

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm version shows 2.0.7
```

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** main
