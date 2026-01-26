# Task TASK-1218: Remove COALESCE Fallback Patterns

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/docs/shared/pr-lifecycle.md`.

---

## Goal

Clean up any COALESCE patterns that were only needed to handle the dual-storage pattern (content in both communications and messages tables).

## Non-Goals

- Do NOT remove COALESCE for legitimate NULL handling
- Do NOT make other changes
- Do NOT change query results

## Deliverables

1. Update: Any files still using COALESCE for communications/messages fallback

## Acceptance Criteria

- [ ] Unnecessary COALESCE patterns removed
- [ ] Legitimate NULL handling preserved
- [ ] Queries return same results as before
- [ ] All tests pass
- [ ] No behavioral changes

## Implementation Notes

### Pattern to Remove

```sql
-- Before (fallback from communications to messages)
SELECT
  COALESCE(c.subject, m.subject) as subject,
  COALESCE(c.body_plain, m.body_plain) as body_plain
FROM communications c
LEFT JOIN messages m ON c.message_id = m.id

-- After (content only in messages)
SELECT
  m.subject,
  m.body_plain
FROM communications c
LEFT JOIN messages m ON c.message_id = m.id
```

### Pattern to KEEP

```sql
-- Legitimate NULL handling (display fallback)
SELECT
  COALESCE(m.subject, '(No Subject)') as subject
FROM messages m
```

### How to Find Patterns

```bash
# Find all COALESCE usage
grep -rn "COALESCE" --include="*.ts" electron/

# Review each one to determine if it's the fallback pattern
```

## Integration Notes

- Depends on: TASK-1217 (columns dropped)
- This is cleanup - should not change behavior
- Low risk since columns are already removed

## Do / Don't

### Do:

- Review each COALESCE usage individually
- Only remove the dual-storage fallback pattern
- Keep NULL handling COALESCE

### Don't:

- Don't remove all COALESCE blindly
- Don't change query semantics

## When to Stop and Ask

- If unsure whether a COALESCE is the fallback pattern
- If removing causes test failures

## Testing Expectations (MANDATORY)

### Unit Tests

- Existing tests must pass

### CI Requirements

- [ ] All checks pass

## PR Preparation

- **Title**: `refactor(db): remove obsolete COALESCE patterns`
- **Labels**: `cleanup`, `refactor`
- **Depends on**: TASK-1217

---

## PM Estimate (PM-Owned)

**Category:** `cleanup`

**Estimated Tokens:** ~8K-10K (apply 0.5x multiplier = ~4K-5K)

**Token Cap:** 40K

**Confidence:** High

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### COALESCE Patterns Found

```
Removed (dual-storage fallback):
- [ ] File:line - pattern

Kept (legitimate NULL handling):
- [ ] File:line - reason
```

### Verification

```
- [ ] npm run type-check passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Review Summary

**Cleanup Appropriate:** PASS / FAIL
**No Breaking Changes:** PASS / FAIL

### Merge Verification (MANDATORY)

- [ ] Merge verified: state shows `MERGED`

---

## After This Task

Proceed to TASK-1219 (SR Engineer full architecture review).
