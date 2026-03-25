# TASK-2319: "Contact Support" Button Should Open Support Widget

**Backlog ID:** BACKLOG-1350
**Sprint:** SPRINT-P
**Branch:** `fix/task-2319-contact-support-widget`
**Branch From:** `develop`
**Branch Into:** `develop`
**Estimated Tokens:** ~15K (ui x1.0)
**Status:** Pending

---

## Objective

Make the "Contact Support" button on error screens and the AccountVerificationStep open the in-app SupportWidget/SupportTicketDialog instead of opening `mailto:support@keeprcompliance.com`.

---

## Context

There are at least three places where "Contact Support" appears:

1. **AccountVerificationStep** (`src/components/onboarding/steps/AccountVerificationStep.tsx`, line 314-318):
   - Currently opens `mailto:support@keeprcompliance.com?subject=Account%20Setup%20Issue`
   - Should instead open the SupportWidget/SupportTicketDialog

2. **ErrorScreen** (`src/appCore/state/machine/components/ErrorScreen.tsx`):
   - Currently does NOT have a "Contact Support" button
   - Has "Submit Error Report" (sends to Supabase), "Try Again", and "Reset App Data"
   - Adding a Contact Support button that opens the widget here would be a nice-to-have

3. **ErrorBoundary** (`src/components/ErrorBoundary.tsx`, line 249/416):
   - Uses `window.api.system.contactSupport(errorDetails)` which opens a mailto link
   - Should also open the SupportWidget instead

4. **AboutSettings** (`src/components/settings/AboutSettings.tsx`, line 57-59):
   - Also uses `handleContactSupport` -- check what this does

The SupportWidget is currently rendered in `App.tsx` (see comment in AppShell.tsx: "TASK-2282: SupportWidget moved to App.tsx"). It is a floating button that opens a SupportTicketDialog.

**Challenge:** The SupportWidget needs a way to be triggered externally (not just by clicking the ? button). This likely requires:
- A global state/event to open the widget
- OR a ref/callback passed down through context

---

## Requirements

### Must Do:

1. **Add a mechanism to programmatically open the SupportWidget.** Options:
   - **Option A (Preferred):** Create a React context (`SupportWidgetContext`) that provides an `openSupportWidget()` function. Wrap it around the app in `App.tsx`.
   - **Option B:** Use a custom event (`window.dispatchEvent(new CustomEvent('open-support-widget'))`) and listen for it in SupportWidget.
   - **Option C:** Export a ref from SupportWidget that exposes an `open()` method.

2. **Update AccountVerificationStep** (line 314-318):
   - Replace `window.api?.shell?.openExternal?.('mailto:...')` with a call to open the support widget
   - If the widget context is not available (e.g., during early onboarding), fall back to the mailto link

3. **Update ErrorBoundary** (line 144-145):
   - Replace `window.api.system.contactSupport(errorDetails)` with the support widget trigger
   - Include the error details as pre-filled context in the ticket

4. **Check AboutSettings** and update if it also uses mailto

### Must NOT Do:
- Do NOT change the SupportWidget's appearance
- Do NOT change the SupportTicketDialog's form fields or behavior
- Do NOT remove the existing error report submission in ErrorScreen (that's a separate feature)
- Do NOT exceed the App.tsx line budget (target 70, trigger >100)

---

## Acceptance Criteria

- [ ] "Contact Support" on AccountVerificationStep opens the support widget (not mailto)
- [ ] "Contact Support" on ErrorBoundary opens the support widget (not mailto)
- [ ] If SupportWidget is not mounted (edge case), falls back gracefully (mailto or no-op)
- [ ] Support widget opens with appropriate context (e.g., "Account Setup Issue" or error details)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Files to Modify

- `src/components/support/SupportWidget.tsx` -- Add external trigger mechanism (context or event listener)
- `src/App.tsx` -- Wrap with context provider if using Option A
- `src/components/onboarding/steps/AccountVerificationStep.tsx` -- Use widget trigger instead of mailto
- `src/components/ErrorBoundary.tsx` -- Use widget trigger instead of mailto
- `src/components/settings/AboutSettings.tsx` -- Update if it uses mailto

## Files to Read (for context)

- `src/components/support/SupportWidget.tsx` -- Current widget implementation
- `src/components/support/SupportTicketDialog.tsx` -- Dialog props and form
- `src/App.tsx` -- Where SupportWidget is currently rendered
- `src/appCore/AppShell.tsx` -- Comment about widget placement

---

## Implementation Notes

### Recommended Approach: Custom Event (Option B)

The simplest approach that avoids prop drilling and context complexity:

```typescript
// In SupportWidget.tsx - add event listener
useEffect(() => {
  const handler = (e: CustomEvent) => {
    setIsOpen(true);
    // Optionally set pre-filled context from event detail
    if (e.detail?.subject) setPrefilledSubject(e.detail.subject);
  };
  window.addEventListener('open-support-widget', handler as EventListener);
  return () => window.removeEventListener('open-support-widget', handler as EventListener);
}, []);

// In AccountVerificationStep.tsx
const handleContactSupport = () => {
  window.dispatchEvent(new CustomEvent('open-support-widget', {
    detail: { subject: 'Account Setup Issue' }
  }));
};

// In ErrorBoundary.tsx
handleContactSupport = () => {
  window.dispatchEvent(new CustomEvent('open-support-widget', {
    detail: { subject: `Error: ${this.state.error?.message}` }
  }));
};
```

This approach:
- No new context providers needed (keeps App.tsx lean)
- Works from any component regardless of tree position
- Degrades gracefully (if widget not mounted, event goes nowhere, no error)
- Simple to implement and test

---

## Testing Expectations

### Unit Tests
- **Required:** Update `SupportWidget.test.tsx` to verify it responds to the custom event
- **Existing tests:** Ensure `ErrorBoundary` tests still pass

### Manual Testing
1. Trigger an error in the app to reach ErrorBoundary -- click "Contact Support" -- verify widget opens
2. Reset onboarding to reach AccountVerificationStep, force an error, click "Contact Support" -- verify widget opens
3. Verify the regular ? button still works as before
4. Verify the widget opens with pre-filled subject when triggered from error screens

### CI Requirements
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## PR Preparation

- **Title:** `fix: wire Contact Support buttons to open support widget instead of mailto (BACKLOG-1350)`
- **Branch:** `fix/task-2319-contact-support-widget`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Read task file completely

Implementation:
- [ ] External trigger mechanism added to SupportWidget
- [ ] AccountVerificationStep updated
- [ ] ErrorBoundary updated
- [ ] AboutSettings checked and updated if needed
- [ ] Type check passes
- [ ] Lint passes
- [ ] Tests pass

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics
- [ ] CI passes
- [ ] SR Engineer review requested
```

### Results

- **Before**: "Contact Support" opens mailto link
- **After**: "Contact Support" opens in-app support widget with context
- **Actual Tokens**: ~XK (Est: 15K)
- **PR**: [URL after PR created]

---

## Guardrails

**STOP and ask PM if:**
- SupportWidget cannot be triggered externally without major refactoring
- The widget is not mounted during onboarding (need to add it to OnboardingShell too)
- App.tsx would exceed 100 lines with the changes
- ErrorBoundary is a class component and cannot easily use hooks/context
