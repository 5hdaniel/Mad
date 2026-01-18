# BACKLOG-305: Fix autoDetection.test.tsx Button Selector Failure

## Status: PENDING
## Priority: Medium
## Category: Testing / Quality
## Estimated Tokens: ~5K

---

## Problem Statement

The `autoDetection.test.tsx` test file has a failing test that expects to find a "Start Detection" button, but the button is not rendered or has a different text.

## Current Behavior

Test failure in `autoDetection.test.tsx`:
```
Expected: "Start Detection"
Received: Unable to find an accessible element with the role "button" and name "Start Detection"
```

The test expects a button with specific text that either:
1. Doesn't exist in the component
2. Has different text
3. Is conditionally rendered and conditions aren't met in test

## Expected Behavior

Test should pass consistently. Either:
1. Component should render the expected button
2. Test should be updated to match actual component behavior
3. Test setup should provide correct conditions for button to render

## Root Cause Analysis

Need to investigate:
1. What button text does the component actually render?
2. Is the button conditionally rendered?
3. Was the component updated without updating tests?

## Proposed Solution

1. Run the failing test to get full error context
2. Read `autoDetection.test.tsx` and related component
3. Either fix component to render expected button, or fix test to match component
4. Verify test passes 3x without flakiness

## Affected Files

- `src/components/**/autoDetection.test.tsx` - Failing test
- Related component file (need to identify)

## Acceptance Criteria

- [ ] `npm test autoDetection.test.tsx` passes
- [ ] Test runs 3x without flakiness
- [ ] No regression in auto-detection functionality

## Related

- **TASK-1120**: Discovered during testing phase (caused 57% testing overhead)

## Notes

This is a medium-priority item because failing tests in CI can mask real regressions. Pre-existing failures should be fixed to maintain test suite integrity.
