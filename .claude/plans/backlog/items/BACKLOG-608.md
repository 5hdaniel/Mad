# BACKLOG-608: OS Notifications for Sync Completion

## Summary

Show native OS notifications when background syncs complete to inform users that their data is ready.

## Problem

When syncs run in the background (especially on app startup or long-running iPhone imports), users have no indication when the sync is done. They may check the app prematurely or miss that new data is available.

## Solution

Use the existing `window.api.notification.send()` API to display OS-level notifications when syncs complete.

## Scope

### Sync Types to Notify

1. **Auto-login sync** (useAutoRefresh) - contacts, emails, messages
2. **Manual refresh** - from Settings or sync buttons
3. **iPhone wired sync** (Windows) - especially important due to long duration
4. **Background stale data refresh** - when external_contacts is refreshed

### Notification Content

| Sync Type | Title | Body |
|-----------|-------|------|
| Auto-sync complete | "Sync Complete" | "Magic Audit is ready. Your data has been synchronized." |
| Contacts only | "Contacts Synced" | "X contacts updated from your address book." |
| iPhone import | "iPhone Import Complete" | "Successfully imported X messages from your iPhone backup." |
| Email scan | "Email Scan Complete" | "Found X new transaction-related emails." |

### Considerations

- Don't spam notifications - aggregate if multiple syncs complete in quick succession
- Make notifications optional (Settings toggle?)
- Focus notification if user clicks it
- Windows vs macOS notification behavior differences

## Technical Notes

Existing notification infrastructure:
```typescript
// Already available in preload
window.api.notification?.send(title, body)
```

## Priority

Medium - Quality of life improvement, especially important for Windows users with long iPhone import times.

## Created

2026-02-02
