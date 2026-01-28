# BACKLOG-536: Settings modal doesn't refresh after email connection

**Priority**: P3 (Minor UI polish)
**Category**: UI/UX
**Discovered**: SPRINT-062 testing

## Problem

After connecting an email account (Gmail/Outlook) during onboarding or from settings, the Settings modal doesn't immediately reflect the connected state. User has to close and reopen the Settings modal to see the "Connected" status with the Disconnect button.

## Expected Behavior

Settings modal should automatically update to show:
- "Connected" badge with green indicator
- User's email address
- "Disconnect" button

...immediately after successful email connection, without requiring modal close/reopen.

## Root Cause

Likely missing state refresh or re-render trigger after email OAuth completes. The connection status is stored but the Settings component doesn't re-fetch or receive updated props.

## Potential Fix

1. Add a refresh callback after email connection success
2. Or use a subscription/listener pattern for connection status changes
3. Or invalidate/refetch the connection status query after OAuth success

## Acceptance Criteria

- [ ] After connecting Gmail, Settings shows connected state immediately
- [ ] After connecting Outlook, Settings shows connected state immediately
- [ ] No manual close/reopen needed
