# BACKLOG-618: Attachment Export Premium Feature Gate

## Summary

Allow all users to VIEW attachments in preview windows (text messages, emails) but require a premium subscription + enabled toggle to EXPORT attachments. Separate controls for message attachments and email attachments.

## Problem

Currently attachments are either fully available or not. This misses a monetization opportunity where:
- Users can see attachments in previews (demonstrates value)
- Export functionality is gated behind premium tier
- Creates upsell opportunity when users try to export

## Solution

### Two-Level Gating

1. **Preview**: All users can see attachments rendered in:
   - Text message preview window
   - Email preview window
   - Transaction detail views

2. **Export**: Requires BOTH:
   - Premium subscription (license check)
   - Toggle enabled in Settings

### Separate Controls

Two independent toggles in Settings:
- "Include Message Attachments in Export"
- "Include Email Attachments in Export"

This allows users to selectively enable/disable based on their needs.

## User Experience

### Free/Basic Users
- See attachments in all preview windows ✓
- Export button shows upgrade prompt when attachments present
- "Upgrade to export attachments" messaging

### Premium Users (Toggle OFF)
- See attachments in all preview windows ✓
- Export excludes attachments (faster, smaller files)
- Can enable toggle anytime

### Premium Users (Toggle ON)
- See attachments in all preview windows ✓
- Export includes attachments ✓
- Full functionality

## Implementation

### 1. License Check

Add `canExportAttachments` to license validation:
```typescript
// electron/services/licenseService.ts
interface LicenseCapabilities {
  canSubmit: boolean;
  canExportAttachments: boolean;  // NEW
  // ...
}
```

### 2. Settings UI

Add to Settings > Export Preferences:
```
Attachment Export (Premium)
┌─────────────────────────────────────────────┐
│ ☑ Include message attachments in export     │
│ ☑ Include email attachments in export       │
│                                             │
│ ℹ️ Attachments increase export file size    │
└─────────────────────────────────────────────┘
```

If not premium, show toggles as disabled with "Upgrade" link.

### 3. Export Logic

Modify export handlers to check:
```typescript
// Before including attachments in export
const canExport = license.canExportAttachments &&
                  (isMessageAttachment ? settings.exportMessageAttachments : settings.exportEmailAttachments);

if (!canExport && hasAttachments) {
  // Show upgrade prompt or skip attachments
}
```

### 4. Preview (No Change)

Preview windows continue to render attachments for all users. No gating on preview.

## Files to Modify

1. `electron/services/licenseService.ts` - Add `canExportAttachments` capability
2. `src/components/settings/ExportSettings.tsx` - Add toggles (new file or existing)
3. `electron/handlers/exportHandlers.ts` - Check license + settings before including attachments
4. `src/components/transactions/TransactionExport.tsx` - Show upgrade prompt if needed
5. `electron/handlers/preferencesHandlers.ts` - Store toggle states

## Database Changes

Add to preferences/settings storage:
```sql
export_message_attachments BOOLEAN DEFAULT false
export_email_attachments BOOLEAN DEFAULT false
```

## Acceptance Criteria

- [ ] Attachments visible in text preview for all users
- [ ] Attachments visible in email preview for all users
- [ ] Export without attachments works for all users
- [ ] Export with attachments requires premium license
- [ ] Two separate toggles (messages vs emails)
- [ ] Toggles disabled/greyed for non-premium users
- [ ] Upgrade prompt shown when non-premium user tries to export with attachments
- [ ] PDF export respects attachment settings
- [ ] CSV/Excel export respects attachment settings

## Estimates

- **Effort**: ~20K tokens
- **Priority**: Medium
- **Category**: Feature (Monetization)

## Notes

- This creates a clear value demonstration (see in preview) → conversion path (pay to export)
- Separate toggles give premium users control over export size
- Consider showing attachment count in export dialog so users know what they're getting
