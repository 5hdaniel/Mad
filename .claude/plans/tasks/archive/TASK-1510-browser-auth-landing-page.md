# TASK-1510: Browser Auth Landing Page with Provider Selection

**Sprint**: SPRINT-062
**Backlog**: BACKLOG-548
**Status**: Ready
**Estimated Tokens**: ~5K
**Execution**: Sequential
**Dependencies**: TASK-1507 (deep link auth flow) - Complete

---

## Summary

Redirect the desktop "Sign in with Browser" button to the broker portal provider selection page instead of hardcoding Google OAuth.

**Key Insight**: The broker-portal already has the provider selection page fully implemented at `broker-portal/app/auth/desktop/page.tsx`. No new pages need to be built - this is just a one-line URL change.

---

## Current Behavior

1. User clicks "Sign in with Browser" in desktop app
2. App opens `supabase.co/auth/v1/authorize?provider=google` directly
3. Only Google OAuth available - no option for Microsoft/Outlook

## Expected Behavior

1. User clicks "Sign in with Browser"
2. App opens broker portal at `/auth/desktop`
3. User sees both Google and Microsoft buttons
4. User clicks their preferred provider
5. OAuth flow continues with chosen provider
6. Deep link callback (`magicaudit://callback`) works the same way

---

## Implementation

### File Changes

| File | Action | Description |
|------|--------|-------------|
| `.env.development` | Modify | Add `BROKER_PORTAL_URL` variable |
| `.env.example` | Modify | Add `BROKER_PORTAL_URL` variable (documented) |
| `electron/handlers/sessionHandlers.ts` | Modify | Update `handleOpenAuthInBrowser()` to use broker portal |

### Step 1: Add Environment Variable

**.env.development** - Add:
```
# Broker Portal URL (for auth provider selection page)
BROKER_PORTAL_URL=http://localhost:3001
```

**.env.example** - Add:
```
# Broker Portal URL (for auth provider selection page)
# Production: https://your-broker-portal.vercel.app
BROKER_PORTAL_URL=http://localhost:3001
```

### Step 2: Update Auth Handler

**electron/handlers/sessionHandlers.ts** - Line ~601

**Current code:**
```typescript
const authUrl = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUrl)}`;
```

**Replace with:**
```typescript
// Use broker portal for provider selection (Google/Microsoft)
const brokerPortalUrl = process.env.BROKER_PORTAL_URL || 'http://localhost:3001';
const authUrl = `${brokerPortalUrl}/auth/desktop`;
```

**Full updated function:**
```typescript
async function handleOpenAuthInBrowser(): Promise<{ success: boolean; error?: string }> {
  try {
    // Use broker portal for provider selection page
    const brokerPortalUrl = process.env.BROKER_PORTAL_URL || 'http://localhost:3001';
    const authUrl = `${brokerPortalUrl}/auth/desktop`;

    await logService.info("Opening auth URL in browser", "AuthHandlers", {
      url: authUrl,
    });

    await shell.openExternal(authUrl);
    return { success: true };
  } catch (error) {
    await logService.error("Failed to open auth in browser", "AuthHandlers", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
```

---

## Testing

### Manual Test Steps

1. Start broker portal: `cd broker-portal && npm run dev` (runs on port 3001)
2. Start desktop app: `npm run dev`
3. Click "Sign in with Browser"
4. Verify browser opens broker portal `/auth/desktop` page
5. Verify both Google and Microsoft buttons are visible
6. Click Google - complete OAuth - verify deep link callback works
7. Log out, repeat with Microsoft button

### Acceptance Criteria

- [ ] Clicking "Sign in with Browser" opens broker portal provider selection page
- [ ] Google button initiates Google OAuth flow
- [ ] Microsoft button initiates Microsoft/Azure OAuth flow
- [ ] Successful auth redirects to `magicaudit://callback` with tokens
- [ ] Both providers work with existing deep link handling
- [ ] No changes needed to broker portal (already implemented)

---

## Notes

### Why This Approach

The broker portal at `broker-portal/app/auth/desktop/page.tsx` already has:
- Google and Microsoft OAuth buttons with brand icons
- Proper Supabase OAuth integration
- Redirect to `/auth/desktop/callback` which triggers `magicaudit://callback`
- Error handling and loading states

No new UI needs to be built - this task is just pointing the desktop app to the existing page.

### Production Considerations

For production builds, `BROKER_PORTAL_URL` should point to the deployed broker portal:
- If using Vercel: `https://broker-portal.vercel.app`
- If using custom domain: `https://portal.magicaudit.com`

This will be set in the packaged app's embedded environment (see TASK-1508B for env var embedding).

---

## Related Files (Reference Only)

- `broker-portal/app/auth/desktop/page.tsx` - Provider selection UI (already complete)
- `broker-portal/app/auth/desktop/callback/page.tsx` - Callback handler (already complete)
- `electron/main.ts` - Deep link handler (unchanged)
