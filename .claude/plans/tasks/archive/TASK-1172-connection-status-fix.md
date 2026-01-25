# TASK-1172: Fix Email Connection Status Mismatch

**Sprint**: SPRINT-052
**Backlog Item**: BACKLOG-458
**Status**: Pending
**Estimated Tokens**: ~30K

---

## Summary

Fix the Settings UI to accurately reflect email OAuth connection status. Currently shows "connected" even when OAuth session is expired/invalid, causing user confusion when sync operations fail.

---

## Branch Information

**Branch From**: develop
**Branch Into**: develop
**Branch Name**: fix/task-1172-connection-status

---

## Problem Statement

### Current Behavior
1. User connects Gmail/Outlook account successfully
2. OAuth session expires or becomes idle
3. Settings UI still shows account as "connected" (stale UI state)
4. User tries to sync emails
5. Backend returns "No email account connected" error
6. User is confused because UI says it's connected

### Root Cause (Investigation Needed)
The connection status in the UI is likely:
- Cached/stored locally and not validated against backend
- Not checking OAuth token validity
- Not listening for session expiration events

---

## Requirements

### Functional Requirements

1. **Validate OAuth token before displaying "connected"**
   - Check token expiry timestamp
   - Optionally validate with provider (lightweight API call)

2. **Handle expired/invalid tokens gracefully**
   - Show "Re-authenticate" button instead of "Connected"
   - Clear error messaging explaining why re-auth is needed

3. **Implement proactive token refresh**
   - Refresh tokens before they expire (e.g., 5 minutes before)
   - Background refresh to avoid user-visible interruptions

4. **Session idle handling**
   - When app session becomes idle, mark connection status as "unknown"
   - Revalidate on resume

### Non-Functional Requirements

- Connection status check should be fast (<500ms)
- Avoid excessive API calls (cache with short TTL)
- Handle network errors gracefully

---

## Technical Approach

### 1. Token Validation Layer

Add validation functions to auth services:

```typescript
// googleAuthService.ts
export async function validateGoogleToken(userId: string): Promise<{
  valid: boolean;
  expiresAt: Date | null;
  needsRefresh: boolean;
}> {
  // Check stored token
  // Validate expiry
  // Return status
}

// microsoftAuthService.ts
export async function validateMicrosoftToken(userId: string): Promise<{
  valid: boolean;
  expiresAt: Date | null;
  needsRefresh: boolean;
}> {
  // Similar implementation
}
```

### 2. Connection Status API

Update `checkAllConnections` to validate tokens:

```typescript
// systemService or similar
async function checkAllConnections(userId: string): Promise<{
  success: boolean;
  google: { connected: boolean; needsReauth: boolean; email?: string };
  microsoft: { connected: boolean; needsReauth: boolean; email?: string };
}> {
  // Call validation for each provider
  // Return detailed status
}
```

### 3. Settings UI Updates

Update `Settings.tsx` to handle new status states:

```tsx
// Instead of just connected/disconnected:
{connection.needsReauth ? (
  <ReAuthButton onClick={handleReconnect} />
) : connection.connected ? (
  <ConnectedBadge email={connection.email} />
) : (
  <ConnectButton onClick={handleConnect} />
)}
```

### 4. Token Refresh Logic

Implement background token refresh:

```typescript
// Background refresh before expiry
async function refreshTokenIfNeeded(userId: string): Promise<void> {
  const status = await validateToken(userId);
  if (status.needsRefresh && !status.expired) {
    await refreshToken(userId);
  }
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `electron/services/googleAuthService.ts` | Add token validation, refresh logic |
| `electron/services/microsoftAuthService.ts` | Add token validation, refresh logic |
| `electron/system-handlers.ts` | Update checkAllConnections |
| `src/components/Settings.tsx` | Handle needsReauth state |
| `src/appCore/state/flows/useEmailHandlers.ts` | Add refresh triggers |

---

## Acceptance Criteria

- [ ] Connection status accurately reflects OAuth token validity
- [ ] Expired tokens show "Re-authenticate" prompt (not "Connected")
- [ ] Token refresh happens automatically before expiry
- [ ] Clear error message when re-authentication is needed
- [ ] Works for both Gmail and Outlook
- [ ] Unit tests for token validation logic
- [ ] Manual testing: connect -> wait for expiry -> verify status updates

---

## Testing Requirements

### Unit Tests
- Token validation logic (valid, expired, needs refresh)
- Connection status mapping
- Refresh trigger conditions

### Manual Testing
1. Connect Gmail -> verify "Connected" status
2. Manually revoke access at Google -> verify status changes
3. Let token expire naturally -> verify re-auth prompt appears
4. Click re-authenticate -> verify flow works
5. Repeat for Outlook

---

## Dependencies

- None (foundational task)

---

## Blocked By

- None

---

## Blocks

- TASK-1173: Sync Emails Must Fetch from Provider

---

## Implementation Summary

*To be filled by engineer after implementation*

### Changes Made
-

### Tests Added
-

### Manual Testing Done
-

### PR
-
