# BACKLOG-458: Email Connection Status Shows Connected When Session Expired

## Summary

The Settings UI shows email accounts (Gmail/Outlook) as "connected" even when the session is idle/expired. This creates user confusion when email sync fails with "No email account connected" error.

## Category

Bug / UX

## Priority

P1 - High (Causes user confusion and broken workflows)

## Description

### Problem

1. User connects Gmail/Outlook account successfully
2. Session expires or becomes idle
3. Settings UI still shows account as "connected" (stale UI state)
4. User tries to sync emails
5. Backend returns "No email account connected" error
6. User is confused because UI says it's connected

### Root Cause

The connection status in the UI is likely:
- Cached/stored locally and not validated against backend
- Not checking OAuth token validity
- Not listening for session expiration events

### Expected Behavior

1. Connection status should reflect actual backend state
2. When session expires, UI should update to show disconnected or prompt re-auth
3. Proactive token refresh before expiration
4. Clear error messaging when re-authentication is needed

## Acceptance Criteria

- [ ] Email connection status accurately reflects backend OAuth state
- [ ] Expired tokens trigger UI update (show disconnected or re-auth prompt)
- [ ] Session idle state clears cached connection status
- [ ] User sees clear message when re-authentication is needed
- [ ] Consider proactive token refresh before expiration

## Technical Investigation Needed

- Where is connection status stored (local state vs backend check)?
- How are OAuth tokens validated?
- Is there a token refresh mechanism?
- What events should trigger status re-check?

## Estimated Effort

~30K tokens

## Dependencies

- OAuth token management
- Session management
- Settings UI state management

## Related Items

- Session idle handling
- OAuth token refresh logic
- BACKLOG-457: Enhance Sync Emails to Fetch from Provider
