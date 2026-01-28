# Addendum 01: Step Completion & State Persistence

**Added:** Post-initial planning
**Affects:** TASK-101, TASK-104, TASK-105, TASK-106, TASK-107 through TASK-112, TASK-113

---

## Requirement 1: Next Button Tied to Step Completion

### Problem
The Next button should be **disabled** until the user completes the required action for that step. This provides:
- Clear indication of what's required
- Prevents accidental advancement
- Dual navigation paths (action button in card OR Next button)

### Solution

#### 1.1 Add `isStepComplete` to OnboardingStepMeta

```typescript
// In types.ts (TASK-101)

interface OnboardingStepMeta {
  // ... existing fields ...

  /**
   * Determines if the step's required action is complete.
   * Used to enable/disable the Next button.
   * If not provided, Next is always enabled (when showNext=true).
   */
  isStepComplete?: (context: OnboardingContext) => boolean;
}
```

#### 1.2 Step-Specific Completion Criteria

| Step | Completion Criteria | `isStepComplete` Implementation |
|------|--------------------|---------------------------------|
| phone-type | Phone type selected | `context.phoneType !== null` |
| secure-storage | Always complete (info screen) | `() => true` or omit |
| email-connect | Email connected OR explicitly skipped | `context.emailConnected \|\| context.emailSkipped` |
| permissions | Permissions granted | `context.hasPermissions` |
| apple-driver | Driver installed OR skipped | `context.hasDriver \|\| context.driverSkipped` |
| android-coming-soon | N/A (custom buttons) | Omit (no Next button) |

#### 1.3 NavigationButtons Enhancement

```typescript
// In NavigationButtons.tsx (TASK-106)

interface NavigationButtonsProps {
  // ... existing props ...

  /** Whether step is complete (enables Next) */
  isStepComplete?: boolean;
}

// In render:
<button
  onClick={onNext}
  disabled={!isStepComplete || nextDisabled}
  className="..."
>
  {nextLabel}
</button>
```

#### 1.4 OnboardingShell Wiring

```typescript
// In OnboardingFlow.tsx (TASK-114)

const isStepComplete = currentStep.meta.isStepComplete?.(context) ?? true;

<NavigationButtons
  // ... other props ...
  isStepComplete={isStepComplete}
/>
```

---

## Requirement 2: Persisted Selections on Back Navigation

### Problem
When users navigate back to a previous step, their selection should:
- Be visually indicated (e.g., iPhone card shows checkmark)
- Be preserved in state (not reset)
- Allow changing the selection if desired

### Solution

#### 2.1 Expand OnboardingContext

```typescript
// In types.ts (TASK-101)

interface OnboardingContext {
  // Platform
  platform: Platform;

  // Phone type (persisted)
  phoneType: 'iphone' | 'android' | null;

  // Email (persisted)
  emailConnected: boolean;
  emailProvider: 'google' | 'microsoft' | null;
  connectedEmail: string | null;  // NEW: actual email address
  emailSkipped: boolean;          // NEW: user explicitly skipped

  // Permissions (persisted)
  hasPermissions: boolean;

  // Secure storage (persisted)
  hasSecureStorage: boolean;

  // Driver (persisted) - Windows only
  hasDriver: boolean;
  driverSkipped: boolean;         // NEW: user explicitly skipped
}
```

#### 2.2 Pass Context to Content Components

Each step's Content component receives the full context and should render based on it:

```typescript
// In PhoneTypeStep Content (TASK-107)

const Content: React.FC<OnboardingStepContentProps> = ({ context, onAction }) => {
  // Show selection state from context
  const selectedType = context.phoneType;

  return (
    <div className="grid grid-cols-2 gap-4">
      <PhoneCard
        type="iphone"
        isSelected={selectedType === 'iphone'}  // Persisted!
        onClick={() => onAction({ type: 'SELECT_PHONE', phoneType: 'iphone' })}
      />
      <PhoneCard
        type="android"
        isSelected={selectedType === 'android'}  // Persisted!
        onClick={() => onAction({ type: 'SELECT_PHONE', phoneType: 'android' })}
      />
    </div>
  );
};
```

#### 2.3 Content Component Props Enhancement

```typescript
// In types.ts (TASK-101)

interface OnboardingStepContentProps {
  /** Full onboarding context with persisted state */
  context: OnboardingContext;

  /** Dispatch actions to update state */
  onAction: (action: StepAction) => void;
}
```

#### 2.4 Visual Selection States Per Step

| Step | Selection Display |
|------|-------------------|
| **phone-type** | Selected card has blue/green border, checkmark badge |
| **email-connect** | Connected provider shows email address, green checkmark |
| **secure-storage** | Checkbox state preserved (don't show again) |
| **permissions** | Status indicator shows granted/pending |
| **apple-driver** | Status shows installed/not installed |

---

## Updated Step Meta Examples

### PhoneTypeStep

```typescript
export const meta: OnboardingStepMeta = {
  id: 'phone-type',
  progressLabel: 'Phone Type',
  title: 'What phone do you use?',
  platforms: ['macos', 'windows'],
  navigation: {
    showBack: false,
    showNext: true,   // CHANGED: Now shows Next button
  },
  skip: false,
  required: true,

  // NEW: Next enabled only when phone selected
  isStepComplete: (context) => context.phoneType !== null,

  getNextStepOverride: (context) => {
    if (context.phoneType === 'android') {
      return 'android-coming-soon';
    }
    return null;
  },
};
```

### EmailConnectStep

```typescript
export const meta: OnboardingStepMeta = {
  id: 'email-connect',
  progressLabel: 'Email',
  title: 'Connect Your Email',
  platforms: ['macos', 'windows'],
  navigation: {
    showBack: true,
    showNext: true,
  },
  skip: {
    enabled: true,
    label: 'Skip for now',
    description: 'You can connect your email later in Settings',
  },
  required: false,

  // Next enabled when email connected (skip handled separately)
  isStepComplete: (context) => context.emailConnected,
};
```

---

## User Flow Examples

### Flow 1: User Selects iPhone, Navigates Back

```
1. User on Phone Type step
   - iPhone card: not selected
   - Android card: not selected
   - Next button: DISABLED

2. User clicks iPhone card
   - iPhone card: SELECTED (checkmark)
   - Android card: not selected
   - Next button: ENABLED
   - Action fired: { type: 'SELECT_PHONE', phoneType: 'iphone' }

3. User clicks Next, advances to Email step

4. User clicks Back, returns to Phone Type
   - iPhone card: STILL SELECTED (from context.phoneType)
   - Android card: not selected
   - Next button: ENABLED

5. User can change selection by clicking Android
   - iPhone card: not selected
   - Android card: SELECTED
   - Action fired: { type: 'SELECT_PHONE', phoneType: 'android' }
```

### Flow 2: User Connects Email, Goes Back, Returns

```
1. User on Email step
   - Gmail card: "Connect Gmail" button
   - Outlook card: "Connect Outlook" button
   - Next button: DISABLED

2. User connects Gmail
   - Gmail card: "user@gmail.com ✓" (connected)
   - Outlook card: "Connect Outlook (optional)"
   - Next button: ENABLED

3. User clicks Back → Phone Type

4. User clicks Next → Email step
   - Gmail card: STILL shows "user@gmail.com ✓"
   - Next button: STILL ENABLED
   - (State persisted from context.emailConnected, context.connectedEmail)
```

---

## Task File Updates Required

### TASK-101 (Type Definitions)
- Add `isStepComplete` to `OnboardingStepMeta`
- Add `connectedEmail`, `emailSkipped`, `driverSkipped` to `OnboardingContext`

### TASK-106 (NavigationButtons)
- Add `isStepComplete` prop
- Disable Next when `!isStepComplete`

### TASK-107 through TASK-112 (All Steps)
- Each step's `meta` must define `isStepComplete`
- Each step's `Content` must read selection state from `context`
- Each step's `Content` must render selected state visually

### TASK-113 (useOnboardingFlow Hook)
- Build context with all persisted state
- Pass `isStepComplete` result to shell

### TASK-114 (Router Integration)
- Ensure app state flows into context correctly
- Handle skip actions updating `emailSkipped`/`driverSkipped`

---

## Implementation Checklist Addition

Add to each step task's acceptance criteria:

```markdown
- [ ] `isStepComplete` defined in meta
- [ ] Content renders persisted selection from context
- [ ] Selection visually indicated (border, checkmark, etc.)
- [ ] Changing selection updates state correctly
- [ ] Next button disabled until step complete
```
