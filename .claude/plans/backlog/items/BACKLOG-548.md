# BACKLOG-548: Browser Auth Landing Page with Provider Selection

**Category**: feature
**Priority**: P1 (High - blocks Microsoft auth testing)
**Sprint**: SPRINT-062
**Estimated Tokens**: ~5K (reduced - broker portal already implemented)
**Status**: Done
**Created**: 2026-01-27
**Updated**: 2026-01-27 (Scope reduced after SR review)
**Source**: User Request

---

## Summary

The "Sign in with Browser" button currently hardcodes Google as the OAuth provider. Users who want to sign in with Microsoft/Outlook have no way to do so.

**UPDATE (2026-01-27):** The broker-portal already has the provider selection page fully implemented at `broker-portal/app/auth/desktop/page.tsx` with both Google and Microsoft buttons. The fix is simply pointing the desktop app to use that page.

## Current Behavior

1. User clicks "Sign in with Browser"
2. App opens `supabase.co/auth/v1/authorize?provider=google` directly
3. No option to choose Microsoft/Outlook

## Expected Behavior

1. User clicks "Sign in with Browser"
2. App opens broker portal at `/auth/desktop` (provider selection page)
3. User clicks their preferred provider button (Google or Microsoft)
4. OAuth flow continues with chosen provider
5. Deep link callback (`magicaudit://callback`) works the same way for both providers

## Technical Approach

**Selected: Option A - Use Broker Portal** (already implemented)

The broker-portal already has a complete desktop auth page at `broker-portal/app/auth/desktop/page.tsx`:
- Google and Microsoft OAuth buttons with brand icons
- Proper Supabase OAuth integration
- Redirect to `/auth/desktop/callback` which triggers `magicaudit://callback`
- Error handling and loading states

**Implementation is a one-line change:**
1. Add `BROKER_PORTAL_URL` env var (default: `http://localhost:3001`)
2. Change `sessionHandlers.ts` to open broker portal instead of direct Supabase URL

## Files to Modify

| File | Change |
|------|--------|
| `.env.development` | Add `BROKER_PORTAL_URL=http://localhost:3001` |
| `.env.example` | Add `BROKER_PORTAL_URL` with documentation |
| `electron/handlers/sessionHandlers.ts` | Update line ~601 to use broker portal URL |

## Acceptance Criteria

- [ ] Clicking "Sign in with Browser" opens broker portal provider selection page
- [ ] Google button initiates Google OAuth flow
- [ ] Microsoft button initiates Microsoft/Azure OAuth flow
- [ ] Successful auth redirects to `magicaudit://callback` with tokens
- [ ] Both providers work with existing deep link handling

## Dependencies

- TASK-1507 (deep link auth flow) - Complete
- Microsoft OAuth must be configured in Supabase dashboard

## Notes

No new UI needs to be built - the broker portal page is already complete with:
- Brand-appropriate Google and Microsoft buttons
- Loading states and error handling
- Proper OAuth redirect chain back to desktop app
