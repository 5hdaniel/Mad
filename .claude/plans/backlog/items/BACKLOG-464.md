# BACKLOG-464: OAuth Reconnect Popup Not Opening

## Summary

Clicking "Reconnect" or "Connect" button for Gmail/Outlook in Settings does NOT open the OAuth popup window. The button click appears to do nothing.

## Category

Bug / Critical

## Priority

P0 - Critical (Users cannot reconnect expired email accounts)

## Description

### Problem

1. User's email connection expires or needs reconnection
2. User clicks "Reconnect" (or "Connect") button in Settings
3. **Nothing happens** - no OAuth popup window opens
4. User cannot reconnect their email account

### Expected Behavior

Clicking "Connect" or "Reconnect" should open a popup window with Google/Microsoft OAuth login.

### Technical Investigation

The flow is:
1. UI calls `window.api.auth.googleConnectMailbox(userId)`
2. IPC invokes `auth:google:connect-mailbox`
3. Handler calls `handleGoogleConnectMailbox(mainWindow, userId)`
4. Should create `BrowserWindow` and load `authUrl`

**Possible causes:**
- `googleAuthService.authenticateForMailbox()` failing silently
- Error before `BrowserWindow` creation
- Popup window being blocked
- `mainWindow` is null

### How to Reproduce

1. Go to Settings
2. Look at Email Connections section
3. Click "Connect Gmail" or "Reconnect Gmail"
4. Observe: nothing happens (no popup)

## Acceptance Criteria

- [ ] Clicking "Connect" opens OAuth popup
- [ ] Clicking "Reconnect" opens OAuth popup
- [ ] Proper error message if popup fails to open
- [ ] Works for both Gmail and Outlook

## Estimated Effort

~20K tokens (debugging + fix)

## Related Items

- BACKLOG-458: Email connection status mismatch
- PR #568: Connection status UI (doesn't fix this)
