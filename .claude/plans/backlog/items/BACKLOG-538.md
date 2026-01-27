# BACKLOG-538: Email connection state not synced to dashboard

**Priority**: P2 (Confusing UX - shows incomplete setup when actually complete)
**Category**: Bug - State Synchronization
**Discovered**: SPRINT-062 testing (2026-01-27)
**Status**: New

## Problem

The "Complete your account setup" banner shows on the dashboard even when the Settings modal shows email as "Connected". The dashboard checks a different state than the Settings modal, leading to inconsistent user experience.

## Expected Behavior

When email is connected (visible in Settings modal), the dashboard should:
1. NOT show the "Complete your account setup" banner for email
2. Show the setup as complete or hide that step
3. Reflect the same connection state as Settings

## Symptoms

- Settings modal: Shows email "Connected" with green indicator
- Dashboard: Shows "Complete your account setup" banner with email connection step
- User confusion: Setup appears incomplete when it's actually done

## Root Cause Analysis (Suspected)

This bug shares the same root cause as BACKLOG-536 (Settings modal doesn't refresh after email connection):

**Email connection state is not propagating properly after OAuth completion.**

The likely issue is:
1. Email OAuth completes successfully
2. Connection status is saved to database/storage
3. Settings modal eventually sees it (on refresh/reopen)
4. Dashboard uses a different state source that never gets updated
5. No event/subscription notifies components of connection status change

## Potential Solutions

1. **Centralized email connection state** - Single source of truth that all components subscribe to
2. **Event-based refresh** - Broadcast "email-connected" event that all interested components listen to
3. **Shared query/cache** - Use React Query or similar to share cached connection status
4. **Force refetch** - After OAuth, explicitly refetch connection status in all affected components

## Related Items

- **BACKLOG-536**: Settings modal doesn't refresh after email connection (same root cause)
- Both bugs should likely be fixed together as they share the same underlying issue

## Files to Investigate

- Dashboard component (setup banner logic)
- Settings modal (email connection display)
- Email connection service/state
- OAuth success callback handlers
- Any email status hooks/contexts

## Acceptance Criteria

- [ ] After connecting email, dashboard banner updates immediately
- [ ] Dashboard and Settings show consistent email connection state
- [ ] No page refresh or modal close/reopen needed
- [ ] Setup completion percentage reflects actual status

## Effort Estimate

~20-30K tokens (may be combined with BACKLOG-536 fix)

## Implementation Note

Consider fixing BACKLOG-536 and BACKLOG-538 together since they share the same root cause. A single PR that properly propagates email connection state would address both.
