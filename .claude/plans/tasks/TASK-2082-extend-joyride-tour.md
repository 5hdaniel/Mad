# Task TASK-2082: Extend Joyride Tour to Audit and Transactions Screens

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/docs/shared/pr-lifecycle.md`.

---

## Goal

Extend the joyride onboarding tour beyond the Dashboard to include the "All Audits" (Transactions list) screen and the new audit creation screen. Currently the tour only covers Dashboard cards. Users should get a guided walkthrough of the key screens they will use most.

## Non-Goals

- Do NOT redesign the existing Dashboard tour steps (keep them as-is)
- Do NOT add tours for Settings, Contacts, or Export screens in this task
- Do NOT change the tour library (react-joyride) or upgrade it
- Do NOT add persistent tour state beyond the existing localStorage approach
- Do NOT auto-navigate the user to different screens -- the tour should trigger when they first visit each screen

## Deliverables

1. Update: `src/config/tourSteps.ts` -- Add `getTransactionsTourSteps()` and `getAuditTourSteps()` step definitions
2. Update: `src/components/Transactions.tsx` (or equivalent transactions list component) -- Add `data-tour` attributes to key UI elements and integrate joyride
3. Update: `src/components/AuditTransactionModal.tsx` (or equivalent new audit screen) -- Add `data-tour` attributes and integrate joyride
4. Create or update any needed test files

## Acceptance Criteria

- [ ] "All Audits" (Transactions list) screen has a joyride tour that triggers on first visit
- [ ] Tour covers: search/filter bar, transaction cards, status indicators, and how to open a transaction
- [ ] New Audit screen has a joyride tour covering: transaction form fields, contact assignment, address entry
- [ ] Each screen's tour uses a separate localStorage key (e.g., `hasSeenTransactionsTour`, `hasSeenAuditTour`)
- [ ] Tours only show once per screen (consistent with existing Dashboard tour behavior)
- [ ] `data-tour` attributes are added to all targeted elements
- [ ] Confetti fires on tour completion (matches Dashboard tour behavior)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Implementation Notes

### Tour Step Definitions

Add to `src/config/tourSteps.ts`:

```typescript
// Transactions List Tour
export const getTransactionsTourSteps = (): Step[] => [
  {
    target: "body",
    content: "This is your Audits page where all your transaction audits live. Let me show you around.",
    placement: "center",
    disableBeacon: true,
  },
  {
    target: '[data-tour="transactions-search"]',
    content: "Search for transactions by address, contact name, or status.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="transactions-filter"]',
    content: "Filter transactions by status to find what you need quickly.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="transaction-card"]',
    content: "Each card shows a transaction's key details. Click to open and view communications, contacts, and audit progress.",
    placement: "bottom",
    spotlightClicks: true,
    disableBeacon: true,
  },
  {
    target: "body",
    content: "You're all set to manage your transaction audits!",
    placement: "center",
    disableBeacon: true,
  },
];

// New Audit Tour
export const getAuditTourSteps = (): Step[] => [
  {
    target: "body",
    content: "Let's walk through creating a new transaction audit.",
    placement: "center",
    disableBeacon: true,
  },
  // Add steps targeting key audit creation elements
  // Engineer should explore the audit creation UI to identify the right targets
];
```

The engineer should explore the actual Transactions and Audit components to find the correct `data-tour` target elements. The above is a starting guide -- the actual step content should match what is visible in the UI.

### Integration Pattern

Follow the same pattern as Dashboard:

```typescript
import Joyride from "react-joyride";
import { useTour } from "../hooks/useTour";
import { getTransactionsTourSteps, JOYRIDE_STYLES, JOYRIDE_LOCALE } from "../config/tourSteps";

// In the component:
const { runTour, handleJoyrideCallback } = useTour(true, "hasSeenTransactionsTour");

// In JSX:
<Joyride
  steps={getTransactionsTourSteps()}
  run={runTour}
  continuous
  showProgress
  showSkipButton
  hideCloseButton
  callback={handleJoyrideCallback}
  styles={JOYRIDE_STYLES}
  locale={JOYRIDE_LOCALE}
/>
```

### Adding data-tour Attributes

Before adding joyride, the target elements need `data-tour` attributes:

```tsx
<div data-tour="transactions-search">
  <SearchBar ... />
</div>
```

The engineer should identify 3-5 key elements per screen. Do not over-tour -- keep it focused on the most important features.

## Integration Notes

- Depends on TASK-2081 (tour/sync dismiss fix) -- must merge first
- No other tasks modify the tour configuration or these components

## Do / Don't

### Do:
- Follow the existing Dashboard tour pattern exactly
- Use `useTour` hook with unique `storageKey` per screen
- Keep tour steps concise and actionable
- Add `data-tour` attributes to elements that need targeting

### Don't:
- Do NOT auto-navigate users between screens during the tour
- Do NOT add more than 6 steps per screen tour
- Do NOT modify the existing Dashboard tour steps
- Do NOT add tours to screens not listed (Settings, Contacts, Export)

## When to Stop and Ask

- If the Transactions or Audit screens have significantly different structures than expected
- If `data-tour` attribute targets would require restructuring component JSX
- If more than 5 files need modification beyond the listed deliverables

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Tour step definitions exist and have correct structure (snapshot-style)
  - Verify `data-tour` attributes render in the DOM
- Existing tests to update:
  - None expected unless existing tests assert on exact DOM structure

### Coverage

- Coverage impact: Slight increase (new tour step tests)

### CI Requirements

This task's PR MUST pass:
- [x] Unit tests
- [x] Type checking
- [x] Lint / format checks

## PR Preparation

- **Title**: `feat(onboarding): extend joyride tour to transactions and audit screens`
- **Labels**: `ui`, `onboarding`
- **Depends on**: TASK-2081
- **Base**: `develop`

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~15K-20K

**Token Cap:** 80K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 3-4 files | +8K |
| Code volume | ~80 lines added | +5K |
| Test complexity | Low (snapshot/structure tests) | +3K |
| Exploration | Need to identify data-tour targets | +4K |

**Confidence:** Medium

**Risk factors:**
- Engineer needs to explore UI to find correct tour targets
- Audit creation may be modal-based which complicates joyride anchoring

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*
