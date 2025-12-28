# BACKLOG-104: Address Remaining 21 Any Types

## Priority: Low

## Category: refactor

## Summary

TASK-610 reduced `any` types from 114 to 5 (justified with eslint-disable comments). However, the original audit identified 114 occurrences across 37 files. A follow-up audit found 21 remaining `any` types in 10 files that need review.

## Origin

SPRINT-009 Retrospective - TASK-610 completed but residual work identified.

## Current State

After TASK-610:
- 5 `any` types remain with eslint-disable (justified)
- 21 additional `any` types in 10 files need review
- Total: 26 `any` types remaining

## Files to Review

Run this command to get current state:
```bash
grep -r ": any" --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".test." | wc -l
```

## Acceptance Criteria

- [ ] All remaining `any` types audited
- [ ] Each `any` either:
  - Replaced with proper type
  - OR has eslint-disable with justification comment
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Estimated Effort

| Metric | Estimate | Notes |
|--------|----------|-------|
| Turns | 4-6 | Apply 0.5x refactor multiplier |
| Tokens | ~20K | |
| Time | ~30-45 min | |

**Note**: Original estimate would be 8-12 turns but refactor tasks consistently complete in 50% of estimated time.

## Dependencies

None - TASK-610 complete

## Pre-Implementation Requirement

**MUST scan scope before starting:**
```bash
# Scan actual any type count and locations
grep -rn ": any" --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".test."
```

Document the actual count in the task file before estimating work.

## Notes

This is cleanup work from SPRINT-009. Low priority as the most critical `any` types were addressed in TASK-610.
