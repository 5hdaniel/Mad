# Task TASK-2062: Cross-Platform Session Management

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**CRITICAL:** Creating a PR is step 3 of 7, not the final step. Task is NOT complete until PR is MERGED.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Implement comprehensive cross-platform session management so that:
1. Desktop auto-detects when its session has been invalidated (e.g., by broker portal "Sign Out All Devices") and redirects to login
2. Broker portal gets a "Sign Out All Devices" button that invalidates all sessions (desktop + broker)
3. Both platforms show an "Active Sessions" list (device name, OS, last active)

## Non-Goals

- Do NOT implement selective per-device sign-out in this task (listed as gap #3 in BACKLOG-800 -- defer to future sprint).
- Do NOT implement session timeout/auto-expire (that is BACKLOG-742 -- separate item).
- Do NOT modify the existing local sign-out flow (only add "Sign Out All Devices" to broker portal and session invalidation detection to desktop).
- Do NOT add SCIM-based session management.

## Prerequisites

**Sprint:** SPRINT-097
**Depends on:** Nothing in Sprint 096 or 097. Independent task.
**Blocks:** Nothing.
**Related PRs:** PR #939 (stale session auto-clear), PR #944 (desktop onLogout flow fix) -- both already merged.

## Context

### Current State

**Desktop app:**
- Has "Sign Out All Devices" in Settings -- calls `supabaseService.signOutAll()` which does `client.auth.signOut({ scope: 'global' })` (line ~241 of `supabaseService.ts`)
- After sign-out-all, the *current* desktop session redirects to login
- **Problem:** Other desktop instances stay logged in with stale UI. They don't detect the session was invalidated until they try a network call that fails.
- Device registration exists via `electron/services/deviceService.ts` -- `devices` table in Supabase tracks `user_id`, `device_id`, `device_name`, `os`, `platform`, `is_active`, `last_seen_at`
- Heartbeat: `updateDeviceHeartbeat()` updates `last_seen_at` periodically

**Broker portal:**
- Has local sign-out only: `broker-portal/app/auth/logout/route.ts` calls `supabase.auth.signOut()` (local scope -- only signs out the current browser session)
- No "Sign Out All Devices" button
- No active sessions list
- Settings page: `broker-portal/app/dashboard/settings/page.tsx` -- currently has org management, no session management

### What Needs to Change

1. **Desktop session invalidation detection**: Poll `supabase.auth.getUser()` periodically (e.g., every 60s). If it returns an error (401/session expired), redirect to login with a message "Your session was signed out from another device."

2. **Broker portal "Sign Out All Devices"**: Add a button in broker portal settings that calls `supabase.auth.signOut({ scope: 'global' })`. This invalidates all Supabase sessions -- desktop, other browser tabs, everything.

3. **Active sessions list**: Query the `devices` table to show where the user is logged in. Show: device name, OS/platform, last active time, current device indicator.

## Requirements

### Must Do:

1. **Desktop: Session invalidation polling**
   - Create a new service or hook that polls `supabase.auth.getUser()` every 60 seconds
   - If the call returns an auth error (session expired / invalid), trigger the logout flow
   - Show a dialog or banner: "Your session was ended from another device. Please sign in again."
   - Clean up local session data (call existing `sessionService.clearSession()` or equivalent)
   - Redirect to the login screen
   - The polling should only run when the user is authenticated and the app is in the foreground
   - Use `electron/services/supabaseService.ts` for the Supabase client access

2. **Desktop: IPC for session validation**
   - Add a new IPC handler: `session:validate-remote` that calls `supabase.auth.getUser()` and returns `{ valid: boolean }`
   - The renderer polls this via `window.api.session.validateRemote()` every 60 seconds
   - If `valid === false`, trigger logout flow

3. **Broker portal: Sign Out All Devices**
   - Add a "Sign Out All Devices" button to the broker portal settings page (`broker-portal/app/dashboard/settings/page.tsx`)
   - Create a server action that calls `supabase.auth.signOut({ scope: 'global' })`
   - After sign-out-all, redirect to login page
   - Add a confirmation dialog before executing (this is destructive)
   - Style to match existing broker portal UI patterns

4. **Desktop: Active Sessions list in Settings**
   - Query the `devices` table: `SELECT device_name, os, platform, last_seen_at, device_id FROM devices WHERE user_id = ? AND is_active = true ORDER BY last_seen_at DESC`
   - Add an IPC handler: `session:get-active-devices` that returns the list
   - Display in the desktop Settings page: a "Sessions" or "Active Devices" section
   - Show for each: device name, OS, last active time (relative: "2 minutes ago", "3 hours ago"), "This device" badge for current device
   - Use `getDeviceId()` from `deviceService.ts` to identify the current device

5. **Broker portal: Active Sessions list**
   - Query the same `devices` table from the broker portal server side
   - Display in broker portal settings: similar layout to desktop
   - Current session is identified as "This browser" (broker portal doesn't register in devices table -- just show "Web Portal" as current)

### Must NOT Do:

- Implement per-device selective sign-out (future feature)
- Modify the existing local sign-out flow
- Add session timeout/auto-expire logic
- Change the device registration logic

## Acceptance Criteria

- [ ] Desktop detects when session is invalidated remotely (within 60 seconds)
- [ ] Desktop shows a clear message explaining why the user was signed out
- [ ] Desktop redirects to login after remote invalidation
- [ ] Broker portal has "Sign Out All Devices" button in settings
- [ ] Broker portal "Sign Out All Devices" shows confirmation dialog
- [ ] Broker portal "Sign Out All Devices" invalidates desktop sessions (verified by testing)
- [ ] Desktop Settings shows "Active Sessions" list with device name, OS, last active
- [ ] Desktop identifies "This device" in the active sessions list
- [ ] Broker portal settings shows active sessions list
- [ ] Session polling only runs when app is authenticated and in foreground
- [ ] `npm test` passes (desktop)
- [ ] `npm run type-check` passes (desktop)
- [ ] `npm run lint` passes (desktop)
- [ ] Broker portal builds without errors

## Deliverables

### Files to Create

| File | Purpose |
|------|---------|
| `src/hooks/useSessionValidator.ts` | Hook that polls session validity every 60s, triggers logout on invalidation |
| `broker-portal/lib/actions/signOutAllDevices.ts` | Server action for global sign-out |
| `broker-portal/components/ActiveSessionsList.tsx` | Component to display active sessions |
| `broker-portal/components/SignOutAllButton.tsx` | Sign Out All Devices button with confirmation |

### Files to Modify

| File | Changes |
|------|---------|
| `electron/handlers/sessionHandlers.ts` | Add `session:validate-remote` and `session:get-active-devices` IPC handlers |
| `electron/preload/authBridge.ts` | Expose `validateRemote()` and `getActiveDevices()` to renderer |
| `src/window.d.ts` | Add type definitions for new IPC channels |
| `src/components/Settings.tsx` | Add "Active Sessions" section |
| `src/components/Dashboard.tsx` or `src/App.tsx` | Mount `useSessionValidator` hook |
| `broker-portal/app/dashboard/settings/page.tsx` | Add Sign Out All Devices button and active sessions list |

### Files to Read (for context)

| File | Why |
|------|-----|
| `electron/services/supabaseService.ts` | `signOutAll()` method at line ~238, Supabase client access |
| `electron/services/deviceService.ts` | `getDeviceId()`, `getDeviceName()`, device registration pattern |
| `electron/services/sessionService.ts` | Session persistence, `clearSession()` method |
| `electron/handlers/sessionHandlers.ts` | Existing session handlers pattern, Sentry usage |
| `electron/preload/authBridge.ts` | Existing auth bridge pattern for IPC exposure |
| `src/components/Settings.tsx` | Current Settings layout for placing Active Sessions section |
| `broker-portal/app/dashboard/settings/page.tsx` | Current broker portal settings for placing Sign Out All + sessions |
| `broker-portal/app/auth/logout/route.ts` | Current broker portal sign-out pattern |
| `broker-portal/lib/supabase/server.ts` | How to create Supabase client in broker portal |

## Implementation Notes

### Session validation polling pattern

```typescript
// useSessionValidator.ts
export function useSessionValidator() {
  const { logout } = useAuth();
  const { isOnline } = useNetwork();

  useEffect(() => {
    if (!isOnline) return; // Don't poll when offline

    const interval = setInterval(async () => {
      try {
        const result = await window.api.session.validateRemote();
        if (!result.valid) {
          // Session was invalidated remotely
          await logout({ reason: 'remote_invalidation' });
        }
      } catch {
        // Network error -- don't logout, just skip this check
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, [isOnline, logout]);
}
```

### IPC handler for session validation

```typescript
// In sessionHandlers.ts
ipcMain.handle('session:validate-remote', async () => {
  try {
    const client = supabaseService.getClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) {
      return { valid: false };
    }
    return { valid: true };
  } catch {
    // Network error -- assume valid (don't logout on network issues)
    return { valid: true };
  }
});
```

### Active sessions query

```typescript
// In sessionHandlers.ts
ipcMain.handle('session:get-active-devices', async (_, userId: string) => {
  const client = supabaseService.getClient();
  const { data, error } = await client
    .from('devices')
    .select('device_id, device_name, os, platform, last_seen_at')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('last_seen_at', { ascending: false });

  if (error) throw error;

  const currentDeviceId = getDeviceId();
  return {
    devices: data.map(d => ({
      ...d,
      isCurrentDevice: d.device_id === currentDeviceId,
    })),
  };
});
```

### Broker portal global sign-out

```typescript
// broker-portal/lib/actions/signOutAllDevices.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function signOutAllDevices() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: 'global' });
  redirect('/login');
}
```

### Foreground detection for polling

Only poll when the app window is focused/visible:
```typescript
const [isVisible, setIsVisible] = useState(!document.hidden);

useEffect(() => {
  const handler = () => setIsVisible(!document.hidden);
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}, []);
```

## Testing Expectations

### Unit Tests

- **Required:** Yes
- **New tests to write:**
  1. `useSessionValidator`: verify polling starts and stops correctly
  2. `useSessionValidator`: verify logout is called when validation returns false
  3. `useSessionValidator`: verify no logout on network error
  4. `session:validate-remote` handler: returns valid/invalid correctly
  5. `session:get-active-devices` handler: returns device list with isCurrentDevice flag
  6. Settings Active Sessions section: renders device list (mock IPC)

### CI Requirements

- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

## Estimation

- **Category:** feature (cross-platform: desktop + broker portal)
- **Base estimate:** ~60K tokens
- **SR overhead:** +20K
- **Final estimate:** ~80K tokens
- **Token Cap:** 320K (4x of 80K)

## PR Preparation

- **Title:** `feat(session): add cross-platform session management with invalidation detection`
- **Branch:** `feature/task-2062-session-management`
- **Target:** `develop`
- **Note:** Broker portal changes may need a separate deploy. Include both desktop and broker portal changes in the same PR for atomic review, or discuss with PM if they should be split.

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: [state before]
- **After**: [state after]
- **Actual Tokens**: ~XK (Est: 80K)
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- The `devices` table schema doesn't match what's described (missing columns)
- `supabase.auth.getUser()` doesn't return an error for invalidated sessions (may need a different check)
- The broker portal Supabase client doesn't support `signOut({ scope: 'global' })` (may need admin client)
- Broker portal settings page structure is significantly different from expected
- Session validation polling causes excessive Supabase API calls (check rate limits)
- More than 10 files need modification across desktop + broker portal (scope check)
- The existing `onLogout` flow in the desktop app doesn't support a `reason` parameter
