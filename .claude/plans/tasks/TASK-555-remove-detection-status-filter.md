# Task TASK-555: Remove detection_status from Filter Logic

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

---

## Goal

Remove all references to `detection_status` from filter logic since this field doesn't exist in SQLite (it works by accident but is incorrect).

## Non-Goals

- Do NOT add detection_status to SQLite (not needed yet)
- Do NOT implement AI detection filtering (future feature)
- Do NOT change the filter UI appearance
- Do NOT refactor unrelated filter code

## Deliverables

1. Update: Filter components - Remove detection_status references
2. Update: Filter utility functions - Remove detection_status logic

## Acceptance Criteria

- [ ] No references to `detection_status` in filter logic
- [ ] No references to `detection_status` in filter UI
- [ ] Existing filters still work correctly
- [ ] No console errors related to missing field
- [ ] `npm run type-check` passes
- [ ] `npm test` passes

## Implementation Notes

### Step 1: Find All References

```bash
# Search for detection_status usage
grep -rn "detection_status" --include="*.ts" --include="*.tsx" src/
```

### Step 2: Analyze Each Reference

For each reference found:
1. Determine if it's in filter logic
2. Check if removing it breaks other functionality
3. Remove or comment out with TODO for future AI detection

### Step 3: Verify Filters Work

After removal:
- All/Active/Closed filters should still work
- Submission status filters should still work
- No TypeScript errors

### Important Details

- The field is referenced but doesn't exist - this is a bug
- Removal should be safe since the field is always undefined
- Leave a TODO comment for future AI detection feature

## Integration Notes

- Depends on: TASK-550 (types alignment, confirms field doesn't exist)
- Used by: TASK-556 (Closed tab will use correct filter logic)
- Conflicts with: TASK-556 (both touch filter components - sequential)

## Do / Don't

### Do:
- Document all removed references
- Add TODO comments for future AI detection
- Test each filter tab after changes

### Don't:
- Remove non-filter references to detection_status
- Change filter behavior beyond removing this field
- Break existing filter functionality

## When to Stop and Ask

- If detection_status is used for more than filtering
- If removal causes unexpected test failures
- If you find detection_status in database service code

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Update any tests that reference detection_status
- Existing tests: Must pass after removal

### CI Requirements

- [ ] Unit tests pass
- [ ] Type checking passes
- [ ] Lint passes

## PR Preparation

- **Title**: `refactor(filters): remove detection_status field (doesn't exist in schema)`
- **Labels**: `refactor`, `filters`, `tech-debt`
- **Depends on**: TASK-550

---

## PM Estimate (PM-Owned)

**Category:** `refactor`

**Estimated Tokens:** ~6K-10K (apply 0.5x refactor multiplier = ~3K-5K effective)

**Token Cap:** 40K (4x upper estimate)

**Confidence:** High

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### References Removed

| File | Line | Change |
|------|------|--------|
| | | |

### Verification

- [ ] Filters work: All
- [ ] Filters work: Active
- [ ] Filters work: Closed (if exists)
- [ ] npm test passes

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Merge Information

**PR Number:** #XXX
**Merged To:** develop
