# BACKLOG-372: Mac Message Source Toggle (Local vs iPhone Cable Sync)

## Summary

Add a setting for Mac users to choose their message source:
- **Local macOS Messages** (current default) - reads from Messages.app database directly
- **iPhone Cable Sync** (same as Windows) - uses iPhone backup files

This enables unified testing across platforms and gives users flexibility.

## Category

architecture / settings

## Priority

High

## Status

Pending

## User Story

**As a** Mac user with an iPhone,
**I want** to choose between using my Mac's local Messages database or syncing via iPhone cable,
**So that** I can use whichever method works best for my setup.

**As a** developer/support team,
**I want** the option to have all users use iPhone cable sync,
**So that** we have one unified code path to test, debug, and support across both platforms.

## Current Behavior

- **Mac**: Accesses Messages.app database and Contacts.app directly via macOS APIs
- **Windows**: Uses iPhone backup files to extract messages and contacts
- Results in two separate code paths requiring separate testing and support procedures
- No user choice on Mac - always uses local Messages.app

## Proposed Behavior

- **Mac**: Setting to choose between:
  - Local macOS Messages (existing behavior)
  - iPhone Cable Sync (same as Windows)
- **Windows**: Continue using iPhone backup files (no change)
- Default can be set to "iPhone Cable Sync" for unified testing

## Feature Requirements

1. **Settings Toggle** - Add setting in Settings > Data & Privacy to choose message source:
   - "Use Mac Messages" (local)
   - "Use iPhone Sync" (cable)

2. **iPhone Backup Detection on Mac** - Detect iPhone backups at `~/Library/Application Support/MobileSync/Backup/`

3. **Conditional Service Routing** - Based on setting, route to:
   - `macOSMessagesImportService` for local
   - `iosBackupService` for iPhone sync

4. **Keep Both Paths Working** - Don't deprecate local access, keep as option

5. **Unified Default** - Can set iPhone Sync as default for unified testing experience

## Benefits

| Benefit | Description |
|---------|-------------|
| Consistency | Same behavior across Mac and Windows |
| Simpler Testing | One code path to test instead of two |
| Easier Support | One method to troubleshoot |
| Reduced Maintenance | Less platform-specific code to maintain |
| Faster Rollout | Single implementation to validate |

## Technical Notes

### Current Architecture (to be deprecated)

- `src/electron/services/macOS/` - Direct macOS Messages.app and Contacts.app access
- Platform detection determines which code path to use

### Target Architecture

- Unified iPhone backup parsing across both platforms
- Remove or deprecate macOS-specific direct access services
- Same user flow: backup iPhone, then sync

### Files Potentially Affected

- `src/electron/services/macOS/macOSMessagesImportService.ts` - Deprecate/remove
- `src/electron/services/macOS/contactsService.ts` - Deprecate/remove
- `src/electron/services/iosBackupService.ts` - May need Mac-specific backup paths
- Platform detection logic
- Onboarding flow (same instructions for both platforms)

## Acceptance Criteria

- [ ] Settings UI shows message source toggle (Mac only)
- [ ] "Use Mac Messages" option works (existing local behavior)
- [ ] "Use iPhone Sync" option works (same as Windows flow)
- [ ] iPhone backup path detected correctly on Mac
- [ ] Setting persists across app restarts
- [ ] Onboarding adapts based on setting (shows cable instructions if iPhone Sync)
- [ ] Both code paths continue to work (no deprecation)
- [ ] Tests cover both paths

## Dependencies

- iPhone backup path detection on macOS (`~/Library/Application Support/MobileSync/Backup/`)
- User must have iPhone backup available if using iPhone Sync option

## Estimated Effort

~40-50K tokens (medium - both code paths exist, need routing + UI)

## Implementation Notes

### Settings UI
```typescript
// In Settings component
<Select value={messageSource} onChange={setMessageSource}>
  <Option value="local">Use Mac Messages (local)</Option>
  <Option value="iphone">Use iPhone Sync (cable)</Option>
</Select>
```

### Service Routing
```typescript
// In message import logic
if (platform === 'darwin' && settings.messageSource === 'iphone') {
  // Use iOS backup service (same as Windows)
  return iosBackupService.importMessages();
} else if (platform === 'darwin') {
  // Use local macOS Messages
  return macOSMessagesImportService.importMessages();
}
```

## Related Items

- BACKLOG-172: macOS Messages Import (may become obsolete with this change)
- BACKLOG-040: ContactsService macOS Paths (may become obsolete)
