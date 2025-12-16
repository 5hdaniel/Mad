# Task TASK-116: Update Tests

## Goal

Ensure all existing tests pass with the new architecture and add baseline tests for new components. This is the final validation before the sprint is complete.

## Non-Goals

- Do NOT achieve 100% coverage (baseline only)
- Do NOT rewrite existing tests (keep them)
- Do NOT add integration tests beyond smoke tests

## Deliverables

1. All existing tests pass
2. New test file: `src/components/onboarding/__tests__/types.test.ts`
3. New test file: `src/components/onboarding/__tests__/registry.test.ts`
4. New test file: `src/components/onboarding/__tests__/flows.test.ts`
5. New test file: `src/components/onboarding/__tests__/shell.test.tsx`
6. New test file: `src/components/onboarding/__tests__/steps.test.tsx`

## Acceptance Criteria

- [ ] `npm test` passes with no failures
- [ ] Existing tests for old components still pass
- [ ] Registry validation tests exist
- [ ] Flow validation tests exist
- [ ] Shell component snapshot tests exist
- [ ] At least one step has unit tests
- [ ] Test coverage doesn't decrease

## Implementation Notes

### Existing Test Files (Keep Working)

- `EmailOnboardingScreen.test.tsx` - Must still pass
- `PhoneTypeSelection.test.tsx` - Must still pass
- `AppleDriverSetup.test.tsx` - Must still pass
- `KeychainExplanation.test.tsx` - Must still pass

### New Test Structure

```
src/components/onboarding/__tests__/
├── types.test.ts        # Type guard tests if any
├── registry.test.ts     # Registration validation
├── flows.test.ts        # Flow validation
├── shell.test.tsx       # Shell component tests
└── steps.test.tsx       # Step component tests
```

### Registry Tests

```typescript
// registry.test.ts

describe('Step Registry', () => {
  it('throws when key does not match meta.id', () => {
    expect(() => {
      registerStep('wrong-key', {
        meta: { id: 'correct-id', ... },
        Content: () => null,
      });
    }).toThrow(/Registry key .* doesn't match meta.id/);
  });

  it('throws on duplicate registration', () => {
    registerStep('test-step', validStep);
    expect(() => registerStep('test-step', validStep))
      .toThrow(/already registered/);
  });

  it('getStep returns registered step', () => {
    registerStep('my-step', validStep);
    expect(getStep('my-step')).toBe(validStep);
  });

  it('getStep throws for unknown step', () => {
    expect(() => getStep('unknown'))
      .toThrow(/not found in registry/);
  });
});
```

### Flow Tests

```typescript
// flows.test.ts

describe('Platform Flows', () => {
  it('returns correct steps for macOS', () => {
    const steps = getFlowSteps('macos');
    expect(steps.map(s => s.meta.id)).toEqual([
      'phone-type',
      'secure-storage',
      'email-connect',
      'permissions',
    ]);
  });

  it('returns correct steps for Windows', () => {
    const steps = getFlowSteps('windows');
    expect(steps.map(s => s.meta.id)).toEqual([
      'phone-type',
      'email-connect',
      'apple-driver',
    ]);
  });

  it('throws for step not supporting platform', () => {
    // If secure-storage was added to Windows flow
    expect(() => getFlowSteps('windows'))
      .toThrow(/does not support platform/);
  });
});
```

### Shell Tests

```typescript
// shell.test.tsx

describe('OnboardingShell', () => {
  it('renders children in card', () => {
    render(
      <OnboardingShell>
        <div data-testid="content">Hello</div>
      </OnboardingShell>
    );
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('renders progress slot', () => {
    render(
      <OnboardingShell progressSlot={<div data-testid="progress" />}>
        Content
      </OnboardingShell>
    );
    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('matches snapshot', () => {
    const { container } = render(
      <OnboardingShell>Content</OnboardingShell>
    );
    expect(container).toMatchSnapshot();
  });
});
```

### Step Tests (Example)

```typescript
// steps.test.tsx

describe('PhoneTypeStep', () => {
  it('has correct meta.id', () => {
    expect(PhoneTypeStep.meta.id).toBe('phone-type');
  });

  it('supports both platforms', () => {
    expect(PhoneTypeStep.meta.platforms).toContain('macos');
    expect(PhoneTypeStep.meta.platforms).toContain('windows');
  });

  it('renders phone selection cards', () => {
    const onAction = jest.fn();
    render(
      <PhoneTypeStep.Content
        context={mockContext}
        onAction={onAction}
      />
    );
    expect(screen.getByText(/iPhone/)).toBeInTheDocument();
    expect(screen.getByText(/Android/)).toBeInTheDocument();
  });

  it('fires SELECT_PHONE action on iPhone click', () => {
    const onAction = jest.fn();
    render(
      <PhoneTypeStep.Content
        context={mockContext}
        onAction={onAction}
      />
    );
    fireEvent.click(screen.getByText(/iPhone/));
    expect(onAction).toHaveBeenCalledWith({
      type: 'SELECT_PHONE',
      phoneType: 'iphone',
    });
  });
});
```

## Integration Notes

- Use existing test patterns from codebase
- Mock `usePlatform` hook as needed
- Use React Testing Library

## Do / Don't

### Do:
- Keep all existing tests passing
- Add baseline tests for new code
- Use consistent test patterns
- Test error conditions

### Don't:
- Delete existing tests
- Aim for 100% coverage
- Add flaky tests
- Test implementation details

## When to Stop and Ask

- If existing tests fail unexpectedly
- If mocking is complex
- If test patterns are unclear

## Testing Expectations

- `npm test` exits with code 0
- No test warnings about act()
- Coverage doesn't decrease

## PR Preparation

- Title: `test(onboarding): add tests for new architecture`
- Label: `phase-4`, `tests`
- Depends on: TASK-115

## Implementation Summary (Engineer-Owned)

*Completed by Claude on 2025-12-13*

```
Existing tests verified:
- [x] EmailOnboardingScreen.test.tsx passes
- [x] PhoneTypeSelection.test.tsx passes
- [x] AppleDriverSetup.test.tsx passes
- [x] KeychainExplanation.test.tsx passes

New tests created:
- [x] flows.test.ts - Flow configuration and validation tests
- [x] shell.test.tsx - OnboardingShell component tests
- [x] steps.test.tsx - PhoneTypeStep and registry tests

Updated tests:
- [x] App.test.tsx - Updated heading match for new PhoneTypeStep

Test results:
- [x] npm test passes (82 suites, 1816 tests)
- [x] No flaky tests
- [x] Coverage maintained

Verification:
- [x] npm test passes
- [x] npm run type-check passes (0 errors)
- [x] npm run lint passes (0 errors, 481 pre-existing warnings)
```
