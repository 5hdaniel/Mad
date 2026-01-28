# TASK-1045: Fix Email Setup Banner UX

## Task Overview

| Field | Value |
|-------|-------|
| **Task ID** | TASK-1045 |
| **Sprint** | SPRINT-035 |
| **Backlog Item** | BACKLOG-224 |
| **Priority** | MEDIUM |
| **Phase** | 2 |
| **Estimated Tokens** | ~30K |
| **Token Cap** | 120K |

---

## Problem Statement

The "Complete your account setup" banner for email connection has two issues:

1. **"Continue Setup" button doesn't work** - Clicking the button has no effect
2. **Banner doesn't auto-dismiss** - After connecting email, the banner should automatically disappear

**This creates confusion during onboarding as the user sees a call-to-action that doesn't function.**

---

## Current Behavior

1. Amber banner appears on dashboard: "Complete your account setup - Connect your email to export communications with your audits"
2. **Clicking "Continue Setup" button does nothing**
3. User can manually dismiss with X button
4. After connecting email, banner may still appear until dismissed

---

## Expected Behavior

1. Amber banner appears for users without email connected
2. **"Continue Setup" button opens email connection flow** (Gmail/Outlook OAuth)
3. **Banner automatically disappears** once email is connected
4. Banner does not reappear after dismissal or successful connection

---

## Files to Investigate

| File | Purpose |
|------|---------|
| `src/components/dashboard/` | Dashboard components (search for banner) |
| `src/components/onboarding/` | Onboarding-related components |
| Search for: "Complete your account setup" | Find exact component |
| Search for: "amber" or "warning" banner | Find styling reference |

---

## Technical Approach

### Issue 1: Button Click Handler

Find and fix the button click handler:

```typescript
// Current (broken)
<Button onClick={handleContinueSetup}>
  Continue Setup
</Button>

// The handler may be:
// - Missing
// - Pointing to wrong function
// - Blocked by event propagation
```

Expected fix:
```typescript
const handleContinueSetup = () => {
  // Open email connection flow
  // Could be:
  // - Navigate to email setup screen
  // - Open email provider selection modal
  // - Trigger OAuth flow directly
  openEmailSetup(); // or navigate('/email-setup')
};
```

### Issue 2: Auto-Dismiss After Connection

Track email connection state and hide banner:

```typescript
// Determine if banner should show
const shouldShowBanner = !emailConnected && !bannerDismissed;

// After email connects, banner should auto-hide
useEffect(() => {
  if (emailConnected) {
    setBannerVisible(false);
  }
}, [emailConnected]);
```

### Issue 3: Persist Dismissal State

If user manually dismisses, remember it:
```typescript
// Store in local storage or user preferences
const dismissBanner = () => {
  localStorage.setItem('emailSetupBannerDismissed', 'true');
  setBannerVisible(false);
};

// On load
const bannerDismissed = localStorage.getItem('emailSetupBannerDismissed') === 'true';
```

---

## Implementation Plan

1. **Find the banner component** - Search codebase for text/styling
2. **Fix button click handler** - Add/fix navigation to email setup
3. **Add auto-dismiss logic** - React to email connection state change
4. **Persist dismissal** - Remember if user dismissed manually
5. **Test both flows** - Gmail and Outlook
6. **Add regression test** - Ensure banner behavior is correct

---

## Acceptance Criteria

- [ ] "Continue Setup" button opens email connection modal/flow
- [ ] Banner auto-dismisses when email account is successfully connected
- [ ] Banner state persists correctly (doesn't reappear after dismiss/connect)
- [ ] Works for both Gmail and Outlook connection flows
- [ ] Manual X dismiss button still works
- [ ] New users see banner, connected users don't

---

## Testing Requirements

### Unit Tests

```typescript
describe('EmailSetupBanner', () => {
  it('shows banner when email not connected', () => {
    render(<EmailSetupBanner emailConnected={false} />);
    expect(screen.getByText('Complete your account setup')).toBeInTheDocument();
  });

  it('hides banner when email is connected', () => {
    render(<EmailSetupBanner emailConnected={true} />);
    expect(screen.queryByText('Complete your account setup')).not.toBeInTheDocument();
  });

  it('Continue Setup button triggers email setup', async () => {
    const onSetup = jest.fn();
    render(<EmailSetupBanner emailConnected={false} onContinueSetup={onSetup} />);

    await userEvent.click(screen.getByText('Continue Setup'));
    expect(onSetup).toHaveBeenCalled();
  });

  it('X button dismisses banner', async () => {
    render(<EmailSetupBanner emailConnected={false} />);

    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText('Complete your account setup')).not.toBeInTheDocument();
  });

  it('persists dismissal in localStorage', async () => {
    render(<EmailSetupBanner emailConnected={false} />);

    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(localStorage.getItem('emailSetupBannerDismissed')).toBe('true');
  });
});
```

### Integration Tests

1. Fresh user - verify banner appears
2. Click Continue Setup - verify email flow opens
3. Complete email connection - verify banner disappears
4. Reload page - verify banner stays hidden

### Manual Testing

1. **Fresh state test:**
   - Clear localStorage/user data
   - Load dashboard
   - Verify amber banner appears

2. **Button test:**
   - Click "Continue Setup"
   - Verify email provider selection appears
   - Complete Gmail OAuth
   - Verify banner disappears

3. **Dismiss test:**
   - Click X button
   - Refresh page
   - Verify banner doesn't reappear

4. **Outlook test:**
   - Repeat with Outlook OAuth flow

---

## UI Reference

Current banner (approximate):
```
+---------------------------------------------------------------+
| [!] Complete your account setup                           [X] |
|     Connect your email to export communications with your     |
|     audits.                                                   |
|                                          [Continue Setup]     |
+---------------------------------------------------------------+
```

---

## Branch Information

**Branch From:** develop
**Branch Into:** develop
**Branch Name:** fix/TASK-1045-email-banner-ux

---

## Implementation Summary

*To be completed by engineer after implementation.*

### Changes Made
-

### Files Modified
-

### Tests Added
-

### Manual Testing Done
-

---

## Dependencies

| Task | Relationship |
|------|-------------|
| TASK-1042 | Must complete Phase 1 first |
| TASK-1043 | Must complete Phase 1 first |
| TASK-1039 | Email onboarding state fix (SPRINT-034) - may be related |

---

## Related Items

| ID | Title | Relationship |
|----|-------|-------------|
| BACKLOG-224 | Email Setup Banner UX Issues | Source backlog item |
| TASK-1039 | Email Onboarding State Fix | Related state management |
| BACKLOG-211 | Email Onboarding State Mismatch | Related issue (fixed) |

---

## Notes

- The banner component was likely added during onboarding feature work
- TASK-1039 fixed email state in Settings - this may share root cause
- Keep fix minimal - just wire up existing functionality
- Consider if button should open modal vs navigate to screen
- Both Gmail and Outlook flows must work
