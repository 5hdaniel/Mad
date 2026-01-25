# BACKLOG-492: Test Outlook/Microsoft Email Sync

**Category**: testing
**Priority**: P0
**Sprint**: SPRINT-056
**Estimated Tokens**: ~5K
**Status**: Pending

---

## Summary

SPRINT-052 only tested Gmail email sync. Microsoft Outlook/Graph sync was never verified and needs manual testing.

## Bug Report

**Discovered**: SPRINT-052/053 review
**Severity**: Unknown (may be working, may be broken)

### Background

Email sync testing during SPRINT-052 focused on Gmail:
- Gmail auth flow tested and working
- Gmail email sync tested and working
- Microsoft/Outlook was not tested

The Microsoft Graph API integration exists but has not been verified end-to-end.

## Requirements

### Manual Testing

1. **Connect Microsoft Account**:
   - Go to Settings
   - Click "Connect Microsoft Outlook"
   - Complete OAuth flow
   - Verify "Connected" status appears

2. **Create Test Transaction**:
   - Create new transaction with unique subject line
   - Example: `[Test-2026-01-24] Outlook Sync Test`

3. **Send Test Email**:
   - From connected Outlook account, send email with matching subject
   - Wait for sync cycle (or trigger manual sync)

4. **Verify Email Appears**:
   - Open transaction
   - Check Emails tab
   - Verify test email appears with correct:
     - Subject
     - Sender
     - Date
     - Body preview

### Test Scenarios

| Scenario | Expected Result |
|----------|-----------------|
| Connect Outlook | OAuth succeeds, "Connected" in Settings |
| Send email to self | Email syncs to matching transaction |
| Email with attachment | Attachment indicator visible |
| Multiple emails | All matching emails sync |
| Disconnect/reconnect | Sync resumes without duplicates |

### If Issues Found

1. Document exact error (console, UI message)
2. Create separate bug backlog item
3. Do not attempt to fix within this testing task

## Acceptance Criteria

- [ ] Microsoft OAuth flow works
- [ ] Outlook shows "Connected" in Settings
- [ ] Emails sync to transactions correctly
- [ ] No duplicate emails
- [ ] No console errors during sync
- [ ] Document any issues found

## Prerequisites

- Microsoft account (personal or work)
- App running in development mode
- Access to browser console for debugging

## Testing Notes

This is primarily a manual testing task. Token estimate is low because:
- Mostly manual verification
- May require minor debugging
- May spawn new bug tickets if issues found

## Related Files

- `electron/services/microsoftGraph/graphService.ts`
- `electron/handlers/emailSyncHandlers.ts`
- `src/components/Settings.tsx` (email connection UI)
