# BACKLOG-304: Fix ESLint react-hooks/exhaustive-deps Rule Not Found

## Status: PENDING
## Priority: Low
## Category: Developer Experience / CI
## Estimated Tokens: ~3K

---

## Problem Statement

During test runs, ESLint reports that the `react-hooks/exhaustive-deps` rule definition is not found in `ContactSelectModal.tsx`, generating a warning that clutters test output.

## Current Behavior

```
Warning: react-hooks/exhaustive-deps rule is not found at contactEditModule/components/ContactSelectModal.tsx
```

This warning appears during `npm run lint` and test runs.

## Expected Behavior

No ESLint warnings about missing rule definitions. Either:
1. The rule should be properly configured
2. The rule should be removed if not needed
3. The ESLint plugin should be properly installed

## Root Cause Analysis

Likely one of:
- `eslint-plugin-react-hooks` not installed
- Plugin not configured in `.eslintrc`
- Rule referenced in file but plugin not loaded

## Proposed Solution

1. Check if `eslint-plugin-react-hooks` is in `package.json`
2. Verify `.eslintrc` includes the plugin in `plugins` array
3. Fix configuration or remove unnecessary rule reference

## Affected Files

- `src/components/contactEditModule/components/ContactSelectModal.tsx` - File triggering warning
- `.eslintrc.*` - ESLint configuration
- `package.json` - Plugin dependencies

## Acceptance Criteria

- [ ] `npm run lint` runs without "rule not found" warnings
- [ ] ContactSelectModal.tsx lints cleanly
- [ ] No regression in hook dependency checking

## Related

- **TASK-1120**: Discovered during testing phase (caused 57% testing overhead)

## Notes

This is a low-priority cleanup item. The warning doesn't break anything but clutters output and may hide real issues.
