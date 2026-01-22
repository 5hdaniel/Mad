# BACKLOG-224: Email Setup Banner UX Issues

## Problem Statement

The "Complete your account setup" banner for email connection has two issues:

1. **"Continue Setup" button doesn't work** - Clicking the button has no effect
2. **Banner doesn't auto-dismiss** - After connecting email, the banner should automatically disappear instead of requiring manual dismiss

## Current Behavior

- Amber banner appears on dashboard: "Complete your account setup - Connect your email to export communications with your audits"
- Clicking "Continue Setup" button does nothing
- User can manually dismiss with X button, but this shouldn't be required after setup is complete

## Expected Behavior

1. "Continue Setup" button should open the email connection flow (Gmail/Outlook OAuth)
2. Once email is successfully connected, the banner should automatically disappear
3. Banner should not reappear after being dismissed or after email is connected

## Location

- Dashboard/home page
- Component likely in: `src/components/` (search for "Complete your account setup" or "amber" banner)

## Priority

Medium - Affects onboarding UX

## Acceptance Criteria

- [ ] "Continue Setup" button opens email connection modal/flow
- [ ] Banner auto-dismisses when email account is successfully connected
- [ ] Banner state persists correctly (doesn't reappear after dismiss/connect)
- [ ] Works for both Gmail and Outlook connection flows

## Notes

- Discovered during SPRINT-034 verification
- User can work around by dismissing with X button
