# BACKLOG-483: Browser Auth Landing Page

**Category**: ui
**Priority**: P0
**Sprint**: SPRINT-058
**Estimated Tokens**: ~30K
**Status**: Pending

---

## Summary

Create a web page in the broker-portal that handles OAuth and redirects to the desktop app.

## Background

The browser auth page allows users to log in using their browser (better password manager support, familiar UX) and then redirects back to the desktop app.

## Requirements

### Pages to Create

1. **Desktop Auth Page** (`/auth/desktop`):
   ```typescript
   // broker-portal/app/auth/desktop/page.tsx
   export default function DesktopAuth() {
     return (
       <div className="min-h-screen flex items-center justify-center">
         <div className="space-y-4">
           <h1>Sign in to Magic Audit</h1>
           <button onClick={loginWithGoogle}>Continue with Google</button>
           <button onClick={loginWithMicrosoft}>Continue with Microsoft</button>
         </div>
       </div>
     );
   }
   ```

2. **Callback Page** (`/auth/desktop/callback`):
   - Gets session from Supabase after OAuth
   - Redirects to `magicaudit://callback?access_token=...&refresh_token=...`
   - Shows "Redirecting to Magic Audit..." message
   - Fallback link if redirect doesn't work

### Flow

```
1. Desktop opens: https://app.magicaudit.com/auth/desktop
2. User clicks login option
3. OAuth flow in browser
4. Callback redirects to magicaudit://callback
5. Desktop receives tokens
```

### Supabase Configuration

- Add `https://app.magicaudit.com/auth/desktop/callback` to redirect URLs
- Configure for both Google and Microsoft OAuth

## Acceptance Criteria

- [ ] Auth page shows Google and Microsoft login buttons
- [ ] OAuth flow completes successfully
- [ ] Callback page redirects to desktop app
- [ ] Fallback link works if auto-redirect fails
- [ ] Loading/redirect states are clear to user
- [ ] Works with both OAuth providers

## Dependencies

- BACKLOG-482: Desktop deep link handler must work first

## Related Files

- `broker-portal/app/auth/desktop/page.tsx`
- `broker-portal/app/auth/desktop/callback/page.tsx`
- Supabase dashboard (redirect URLs)
