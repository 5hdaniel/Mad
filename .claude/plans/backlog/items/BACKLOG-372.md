# BACKLOG-372: Switch Mac to iPhone Backup for Messages/Contacts

## Summary

Currently on Mac, the app accesses Messages.app and Contacts.app directly via native macOS APIs. This creates two different code paths (Mac vs Windows). Switch Mac to use iPhone backup files (same as Windows) for consistency and easier support.

## Category

architecture

## Priority

High

## Status

Pending

## User Story

**As a** developer/support team,
**I want** Mac to use iPhone backup for messages and contacts (same as Windows),
**So that** we have one unified code path to test, debug, and support across both platforms.

## Current Behavior

- **Mac**: Accesses Messages.app database and Contacts.app directly via macOS APIs
- **Windows**: Uses iPhone backup files to extract messages and contacts
- Results in two separate code paths requiring separate testing and support procedures

## Proposed Behavior

- **Mac**: Use iPhone backup files (same method as Windows)
- **Windows**: Continue using iPhone backup files (no change)
- Single unified code path for both platforms

## Feature Requirements

1. **Use iPhone Backup on Mac** - Instead of accessing Messages.app and Contacts.app directly, use iPhone backup files on Mac (same method as Windows)

2. **Remove/Deprecate Direct Access** - Phase out the Messages.app and Contacts.app direct access code paths

3. **Unified Code Path** - Same backup parsing logic across both platforms

4. **Easier Support** - One method to debug/support instead of two

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

- [ ] Mac version uses iPhone backup for messages extraction
- [ ] Mac version uses iPhone backup for contacts extraction
- [ ] Same user flow on Mac as Windows (backup iPhone, then sync)
- [ ] Direct Messages.app/Contacts.app access removed or deprecated
- [ ] All existing functionality preserved (message import, contact import, attachments)
- [ ] Tests updated to reflect unified code path
- [ ] Documentation updated for Mac users

## Dependencies

- iPhone backup path detection on macOS (different from Windows)
- User must have iPhone backup available on Mac

## Estimated Effort

~80K tokens (architecture change affecting multiple services)

## Related Items

- BACKLOG-172: macOS Messages Import (may become obsolete with this change)
- BACKLOG-040: ContactsService macOS Paths (may become obsolete)
