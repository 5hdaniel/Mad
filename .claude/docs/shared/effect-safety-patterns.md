# Effect Safety Patterns

**Status:** MANDATORY patterns to prevent production bugs
**Last Updated:** 2024-12-24

---

## Background

These patterns were identified after the `int/ai-polish` incident where three related bugs caused infinite loops and empty screens for returning users. Following these patterns is non-negotiable.

---

## Pattern 1: Callback Effects Must Use Ref Guards

**Problem:** Any `useEffect` that calls a prop callback can cause infinite loops if the parent re-renders when the callback is invoked.

```typescript
// BAD - causes infinite loops if parent re-renders on callback
useEffect(() => {
  onValueChange?.(value);
}, [value, onValueChange]);
```

**Solution:** Track the last-reported value with a ref to prevent duplicate calls:

```typescript
// GOOD - ref guard prevents duplicate calls
const lastValueRef = useRef<typeof value | null>(null);

useEffect(() => {
  if (onValueChange && lastValueRef.current !== value) {
    lastValueRef.current = value;
    onValueChange(value);
  }
}, [value, onValueChange]);
```

**When to apply:** Any `useEffect` that calls `onXChange`, `onComplete`, `onUpdate`, or similar prop callbacks.

---

## Pattern 2: Flow Components Must Navigate on Empty State

**Problem:** Components that can have zero steps return `null`, leaving the user stuck on a blank screen.

```typescript
// BAD - component returns null but user is stuck
if (steps.length === 0) return null;
```

**Solution:** Actively navigate when there's nothing to show:

```typescript
// GOOD - actively navigates when nothing to show
useEffect(() => {
  if (steps.length === 0) {
    app.goToStep("dashboard");
  }
}, [steps.length, app]);

// Then handle the case in render
if (steps.length === 0) {
  return null; // Safe because useEffect already triggered navigation
}
```

**When to apply:** Any wizard, flow, or multi-step component that conditionally has zero steps.

---

## Pattern 3: Related Booleans Must Be Checked Together

**Problem:** Completion flags checked in isolation can route users incorrectly when the actual state differs from the flag.

```typescript
// BAD - user with connected email still routed to onboarding
const needsEmailOnboarding = !hasCompletedEmailOnboarding;
```

**Solution:** Check completion flags AND actual state together:

```typescript
// GOOD - checks both completion flag AND actual connection state
const needsEmailOnboarding = !hasCompletedEmailOnboarding && !hasEmailConnected;
```

**When to apply:** Any routing or conditional logic based on "has completed X" flags.

---

## Review Checklist

Use this checklist when reviewing PRs:

### Callback Effects
- [ ] All `useEffect` hooks that call prop callbacks use ref guards
- [ ] Ref guards track the actual value being reported, not just a boolean
- [ ] The ref is updated BEFORE calling the callback

### Empty State Navigation
- [ ] Flow components handle `length === 0` with navigation, not just `return null`
- [ ] Navigation is triggered in `useEffect`, not in render
- [ ] The component gracefully handles the brief render before navigation

### Boolean Flag Logic
- [ ] Completion flags are paired with actual state checks
- [ ] Negated booleans are combined with `&&`, not checked alone
- [ ] Edge cases are considered (flag true but state false, and vice versa)

---

## Detection Commands

Find potential issues in the codebase:

```bash
# Find useEffect with prop callbacks (potential missing ref guards)
grep -rn "useEffect.*on[A-Z].*Change\|onComplete\|onUpdate" src/ --include="*.tsx"

# Find components returning null on empty arrays
grep -rn "\.length === 0.*return null" src/ --include="*.tsx"

# Find isolated completion flag checks
grep -rn "!has.*Completed" src/ --include="*.tsx" --include="*.ts"
```

---

## Examples from Production Bugs

### Bug 1: Infinite Loop in EmailOnboardingFlow
```typescript
// This caused infinite re-renders:
useEffect(() => {
  onPhoneTypeChange?.(selectedPhoneType);
}, [selectedPhoneType, onPhoneTypeChange]);

// Fixed with ref guard:
const lastPhoneTypeRef = useRef<string | null>(null);
useEffect(() => {
  if (onPhoneTypeChange && lastPhoneTypeRef.current !== selectedPhoneType) {
    lastPhoneTypeRef.current = selectedPhoneType;
    onPhoneTypeChange(selectedPhoneType);
  }
}, [selectedPhoneType, onPhoneTypeChange]);
```

### Bug 2: Blank Screen After Email Connect
```typescript
// This left users on blank screen:
if (onboardingSteps.length === 0) return null;

// Fixed with navigation:
useEffect(() => {
  if (onboardingSteps.length === 0) {
    app.goToStep("dashboard");
  }
}, [onboardingSteps.length, app]);
```

### Bug 3: Returning Users Stuck in Onboarding
```typescript
// This sent connected users back to onboarding:
const needsEmailOnboarding = !hasCompletedEmailOnboarding;

// Fixed by checking actual state:
const needsEmailOnboarding = !hasCompletedEmailOnboarding && !hasEmailConnected;
```

---

## References

- Incident analysis: `int/ai-polish` branch history
- PR reviews should reference this document when these patterns are violated
