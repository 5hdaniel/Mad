# BACKLOG-092: Rename transactionDetailsModule to transactionDetails

## Priority: Low

## Category: refactor

## Summary

Rename the `transactionDetailsModule` directory to `transactionDetails` for naming consistency with other component modules in the codebase.

## Problem

The component directory `src/components/transactionDetailsModule/` uses an inconsistent naming pattern with the `Module` suffix. All other feature directories follow the pattern `src/components/<featureName>/` without suffixes:

- `src/components/contact/`
- `src/components/onboarding/`
- `src/components/transaction/`
- `src/components/settings/`

The `transactionDetailsModule` naming is inconsistent and confusing.

## Solution

Rename the directory and update all imports:

```bash
# Before
src/components/transactionDetailsModule/

# After
src/components/transactionDetails/
```

## Implementation

1. Rename directory: `transactionDetailsModule` -> `transactionDetails`
2. Update all imports across the codebase
3. Verify no broken imports
4. Run type-check and lint

## Files Affected

- `src/components/transactionDetailsModule/` (directory rename)
- All files importing from this module (import path updates)

## Acceptance Criteria

- [ ] Directory renamed to `transactionDetails`
- [ ] All imports updated
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Estimated Effort

| Metric | Estimate | Notes |
|--------|----------|-------|
| Turns | 2-3 | Simple rename + import updates |
| Tokens | ~10K | |
| Time | 15-20 min | |

## Dependencies

- None (can be executed immediately)

## Risk

Low - This is a simple rename operation with automated import updates.
