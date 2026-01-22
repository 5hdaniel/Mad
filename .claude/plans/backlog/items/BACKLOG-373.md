# BACKLOG-373: Android Device Support

## Summary

Currently the app only supports iPhone. Users with Android phones cannot use the app to audit their text messages. Need to add Android support to significantly expand the user base.

## Category

feature

## Priority

High

## Status

Pending

## User Story

**As a** real estate professional with an Android phone,
**I want** to import and audit my text messages from my Android device,
**So that** I can maintain compliance records and audit trails for my real estate transactions.

## Current Behavior

- App only supports iPhone message import
- Onboarding shows "Android" option but displays "coming soon" message
- Users with Android devices cannot use the text message audit functionality
- Only iPhone backup files are supported

## Proposed Behavior

- Full Android device support alongside iPhone
- Users can select Android in onboarding and proceed through full flow
- Android backup files can be imported and parsed
- Android SMS/MMS messages displayed in same format as iMessage
- Same audit and export functionality available for Android users

## Feature Requirements

1. **Android Backup Parsing** - Support Android backup file formats:
   - ADB backup (.ab files)
   - Google backup (Google One/Drive)
   - Samsung Smart Switch backup
   - Other manufacturer-specific formats as needed

2. **Android Message Formats** - Parse Android SMS/MMS database formats:
   - Different storage format than iMessage
   - SMS stored in mmssms.db typically
   - MMS attachments stored separately
   - Handle various Android OS versions

3. **Android Contacts Import** - Import contacts from Android backup:
   - Parse Android contacts database
   - Map to existing contact schema
   - Handle different backup formats

4. **Onboarding Flow Update** - Update phone type selection:
   - Remove "coming soon" label from Android option
   - Full Android onboarding path
   - Android-specific instructions for creating backups
   - Platform-appropriate guidance

5. **Platform Detection** - Detect when Android device/backup is connected:
   - Identify Android backup files
   - Distinguish from iPhone backups
   - Appropriate error handling for unsupported formats

## Technical Considerations

### Backup Format Variability

| Manufacturer | Backup Format | Notes |
|--------------|---------------|-------|
| Google Pixel | Google backup | Cloud-based, may need different approach |
| Samsung | Smart Switch | Proprietary format |
| Generic | ADB backup | Standard Android backup format |
| Various | Local files | May have manufacturer customizations |

### Message Storage Differences

- Android uses SQLite database (mmssms.db) vs iPhone backup format
- No iMessage-specific features (reactions, tapbacks, read receipts style)
- MMS handling differs from iMessage attachments
- Thread structure may differ

### Android Version Considerations

- Database schema may vary across Android versions
- Encryption handling differs from iOS
- Permissions model is different

## Acceptance Criteria

- [ ] Users can select Android in onboarding (remove "coming soon")
- [ ] At least one Android backup format can be imported (ADB recommended as baseline)
- [ ] Android SMS messages parsed and stored in database
- [ ] Android MMS messages with attachments handled
- [ ] Android contacts imported and mapped correctly
- [ ] Messages displayed in conversation view (same UX as iPhone)
- [ ] Export functionality works for Android messages (PDF, audit package)
- [ ] Onboarding provides Android-specific backup instructions
- [ ] Error handling for unsupported Android backup formats
- [ ] Tests cover Android parsing logic

## Out of Scope (Initial Release)

- RCS messages (rich messaging) - may be added later
- WhatsApp/Signal/Telegram integration
- Real-time Android device sync (backup file approach only)
- Every manufacturer's proprietary backup format (focus on ADB + 1-2 major ones)

## Dependencies

- Research into Android backup file formats
- Test devices/backups for development
- May need manufacturer-specific documentation

## Files Potentially Affected

- `src/components/onboarding/` - Phone type selection
- New: `src/electron/services/android/` - Android parsing services
- New: `src/electron/services/android/androidBackupParser.ts`
- New: `src/electron/services/android/androidMessagesParser.ts`
- New: `src/electron/services/android/androidContactsParser.ts`
- `src/electron/services/iosBackupService.ts` - May need abstraction
- Database schema (if Android-specific fields needed)
- IPC handlers for Android operations

## Estimated Effort

~150K tokens (large feature with multiple components)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Backup format variability | High | Medium | Start with ADB format, add others incrementally |
| Android version differences | Medium | Medium | Test across major versions, graceful degradation |
| Encryption in backups | Medium | High | Research encryption handling upfront |
| Scope creep | Medium | High | Define clear MVP with one backup format |

## Related Items

- BACKLOG-172: macOS Messages Import (similar expansion pattern)
- BACKLOG-372: Switch Mac to iPhone Backup (architecture consideration)
