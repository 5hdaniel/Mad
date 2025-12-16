# TASK-202: Fix AppleDriverSetup.test.tsx Flaky Tests

**Backlog ID:** BACKLOG-059
**Sprint:** TECHDEBT-2024-01
**Phase:** 1 (Test Stabilization)
**Branch:** `fix/task-202-driver-tests`
**Estimated Turns:** 10-15
**Estimated Tokens:** 40-60K

---

## Objective

Re-enable and fix the 8 skipped tests in `src/components/__tests__/AppleDriverSetup.test.tsx` that were disabled due to timing issues with fake timers and UI text changes.

---

## Context

The AppleDriverSetup component handles Windows-specific driver installation for iPhone sync. Tests were skipped due to:
1. **Timing issues with fake timers** - Installation success/error flows use timers that don't work correctly with Jest fake timers
2. **UI text changes** - "Skip for now" button text may have changed
3. **Progress indicator changes** - Step names in the progress indicator may have been renamed
4. **Auto-skip logic timing** - Race conditions when drivers are already installed

---

## Skipped Tests (8 total)

### Already Installed State (1 test)
- Line 114: `should immediately skip when drivers are already installed (no update available)`
  - **Issue:** Auto-skip logic has timing issues

### Not Installed State - With Bundled MSI (2 tests)
- Line 208: `should show skip option`
  - **Issue:** "Skip for now" text may have changed
- Line 220: `should call onSkip when skip button is clicked`
  - **Issue:** Skip button text/selector needs update

### Installation Flow (2 tests)
- Line 321: `should complete successfully after successful installation`
  - **Issue:** Fake timer issues - `jest.advanceTimersByTime` not working correctly
- Line 355: `should show error state when installation fails`
  - **Issue:** Test times out

### Error/Cancelled State Actions (2 tests)
- Line 428: `should show Try Again and Install iTunes buttons in error state`
  - **Issue:** Error state buttons not rendering as expected
- Line 452: `should retry installation when Try Again is clicked`
  - **Issue:** Retry flow has timing issues

### Progress Indicator (entire describe block - 2 tests)
- Line 511: `describe.skip("Progress Indicator")`
  - **Issue:** Step names may have changed in component

---

## Requirements

### Must Do:
1. Read the current AppleDriverSetup component implementation:
   - `src/components/AppleDriverSetup.tsx`

2. For timing issues:
   - Consider using `waitFor` instead of `jest.advanceTimersByTime`
   - Use `act()` wrapper appropriately
   - Consider `userEvent.setup({ advanceTimers: jest.advanceTimersByTime })` pattern
   - Try running with real timers if fake timers are problematic

3. For UI text issues:
   - Check actual button text in component
   - Update selectors to match current UI

4. For each skipped test:
   - Understand original intent
   - Update to work with current component
   - Remove `.skip` and verify test passes

### Must NOT Do:
- Change AppleDriverSetup.tsx implementation (test-only changes)
- Delete tests that test valid behavior
- Add new tests
- Modify other test files

---

## Acceptance Criteria

- [ ] All 8 previously skipped tests are now running
- [ ] All tests pass (no failures)
- [ ] No tests are flaky (run 3x to verify)
- [ ] `npm test -- --testPathPattern=AppleDriverSetup.test.tsx` passes
- [ ] No changes to production code

---

## Implementation Notes

### Fake Timer Pattern (if needed)
```typescript
// Option 1: Use real timers with longer waitFor timeout
jest.useRealTimers();
await waitFor(() => {
  expect(screen.getByText("Tools Installed!")).toBeInTheDocument();
}, { timeout: 3000 });

// Option 2: Proper fake timer setup
jest.useFakeTimers();
const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

// After triggering action
await act(async () => {
  jest.runAllTimers();
});
```

### Button Text Pattern
```typescript
// If button text changed, find by role + partial match
screen.getByRole('button', { name: /skip/i })
```

---

## Files to Modify

- `src/components/__tests__/AppleDriverSetup.test.tsx` - Fix skipped tests

## Files to Read (for context)

- `src/components/AppleDriverSetup.tsx` - Current component implementation

---

## Testing Expectations

### Unit Tests
- **Required:** Yes (fixing existing tests)
- **New tests to write:** None
- **Existing tests to update:** 8 skipped tests

### CI Requirements
- [ ] `npm test -- --testPathPattern=AppleDriverSetup.test.tsx` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `fix(tests): re-enable AppleDriverSetup.test.tsx skipped tests`
- **Branch:** `fix/task-202-driver-tests`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

*Completed: 2024-12-15*

### Checklist

```
Tests fixed:
- [x] Auto-skip timing test (changed to test actual Continue button behavior)
- [x] Skip option text test (case-insensitive regex)
- [x] Skip button click test (getByRole for reliability)
- [x] Installation success flow test (fixed text: "Tools Ready!")
- [x] Error state test (was working, just removed skip)
- [x] Error state buttons test (getByRole for reliability)
- [x] Retry flow test (added fake timers + fixed text)
- [x] Progress indicator tests (2) - updated to 3 steps

Verification:
- [x] npm test -- --testPathPattern=AppleDriverSetup.test.tsx passes
- [x] Tests run 3x without flakiness
- [x] No production code changes
```

### Results
- **Before**: 14 passed, 8 skipped
- **After**: 22 passed, 0 skipped
- **Actual Turns**: 4 (Est: 10-15)
- **PR**: https://github.com/5hdaniel/Mad/pull/130

### Notes

**Deviations from plan:**
1. Already-installed test: Changed expectation completely. Component doesn't auto-skip - it shows "Already Installed" state with Continue button. Updated test to verify this behavior instead.

2. Progress indicator: Component has 3 steps (Phone Type, Connect Email, Install Tools), not 4. Removed "Sign In" from expected steps.

**Issues encountered:**
- Text assertions were case-sensitive causing skip button tests to fail ("Skip for Now" vs "Skip for now")
- Installation success shows "Tools Ready!" header, not "Tools Installed!" as test expected
- Used `getByRole` for button selections which is more reliable than text matching

---

## Guardrails

**STOP and ask PM if:**
- Tests require changes to AppleDriverSetup.tsx to be testable
- You discover bugs in the component while fixing tests
- More than 3 tests need completely different approaches (may need task scope change)
- Fake timer issues cannot be resolved with standard patterns
