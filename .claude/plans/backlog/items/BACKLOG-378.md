# BACKLOG-378: Call Log Support for Transaction Audits

## Summary

Real estate agents make many phone calls during transactions. Auditors need visibility into call logs (incoming, outgoing, missed calls) with contacts involved in a transaction to have a complete communication audit trail.

## Category

feature

## Priority

Medium

## Status

Pending

## User Story

**As a** real estate compliance auditor,
**I want** to see phone call logs alongside emails and text messages in transaction audits,
**So that** I have a complete picture of all communications for compliance and record-keeping purposes.

## Current Behavior

- Only email and text message communications are tracked
- Phone calls are not captured or displayed
- Audit exports only include written communications
- No visibility into call frequency, duration, or direction with transaction contacts

## Proposed Behavior

- Call logs imported from iPhone backup
- New "Calls" tab in transaction details
- Call logs filtered by transaction contacts
- Call logs included in audit exports
- Calls displayed in timeline alongside emails and texts

## Feature Requirements

### 1. Call Log Import

Import call logs from iPhone backup:
- Phone number
- Call direction (incoming, outgoing, missed)
- Call duration (seconds)
- Timestamp
- Contact name (if matched in contacts database)

### 2. Call Log Storage

Store call logs in database:
- New `call_logs` table with appropriate schema
- Link to contacts (via phone number matching)
- Link to transactions (via contact association)
- Searchable and filterable

### 3. Transaction Details Tab - Calls

New "Calls" tab in transaction details:
- List all calls to/from contacts assigned to the transaction
- Filter by: incoming, outgoing, missed
- Sort by date (newest first default)
- Show call duration (formatted: 0:00, 1:23, etc.)
- Show contact name and phone number
- Show call direction icon
- Empty state when no calls found

### 4. Export Integration

Include call logs in audit exports:
- Call log summary section in PDF
- Call log appendix with detailed list
- Timeline integration (calls shown alongside emails/texts)
- Call statistics per contact (total calls, total duration)

### 5. Android Support (Future)

When Android is added (BACKLOG-373), include Android call logs:
- Same schema and UI
- Android call log database parsing
- Platform-agnostic call log display

## Technical Considerations

### Database Schema

```sql
CREATE TABLE call_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_number TEXT NOT NULL,
  contact_id INTEGER,
  direction TEXT NOT NULL, -- 'incoming', 'outgoing', 'missed'
  duration INTEGER, -- seconds
  timestamp TEXT NOT NULL,
  device_source TEXT, -- 'iphone', 'android'
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contact_id) REFERENCES contacts(id)
);

CREATE INDEX idx_call_logs_phone ON call_logs(phone_number);
CREATE INDEX idx_call_logs_contact ON call_logs(contact_id);
CREATE INDEX idx_call_logs_timestamp ON call_logs(timestamp);
```

### iPhone Backup Location

Call history is stored in:
- `HomeDomain/Library/CallHistoryDB/CallHistory.storedata` (iOS 8+)
- SQLite database with `ZCALLRECORD` table

### Call Record Fields (iOS)

| iOS Field | Mapped Field |
|-----------|--------------|
| ZADDRESS | phone_number |
| ZCALLTYPE | direction (4=incoming, 1=outgoing, 16=missed) |
| ZDURATION | duration |
| ZDATE | timestamp (Core Data timestamp) |

### Phone Number Matching

- Normalize phone numbers before matching (strip formatting)
- Match to existing contacts by phone number
- Handle multiple phone numbers per contact
- Consider international number formats

## Acceptance Criteria

- [ ] Call logs imported from iPhone backup during sync
- [ ] New `call_logs` database table created and populated
- [ ] Calls linked to contacts by phone number
- [ ] New "Calls" tab visible in transaction details
- [ ] Calls filtered by contacts assigned to transaction
- [ ] Incoming/outgoing/missed filter works
- [ ] Sort by date works
- [ ] Call duration displayed in human-readable format
- [ ] Contact name displayed (or "Unknown" if no match)
- [ ] Call logs included in PDF export
- [ ] Call logs included in audit package export
- [ ] Timeline shows calls (if timeline feature exists)
- [ ] Tests cover call log parsing and display
- [ ] Empty state shown when no calls for transaction

## Out of Scope (Initial Release)

- VoIP calls (FaceTime Audio, WhatsApp calls, etc.)
- Call recordings (not accessible)
- Real-time call monitoring
- Android call logs (deferred to BACKLOG-373)
- Call transcription

## Dependencies

- BACKLOG-373: Android Device Support (for future Android call logs)
- Existing iPhone backup parsing infrastructure
- Contact matching service

## Files Potentially Affected

- New: `src/electron/services/callLogService.ts` - Call log parsing and storage
- New: `src/electron/services/callLogParser.ts` - iPhone call history parsing
- `src/electron/services/iosBackupService.ts` - Add call log file extraction
- New: `src/components/transactionDetails/CallsTab.tsx` - Calls tab UI
- `src/components/transactionDetails/TransactionDetails.tsx` - Add tab
- Database migrations - New `call_logs` table
- `src/electron/services/folderExportService.ts` - Add call export
- `src/electron/services/pdfExportService.ts` - Add call section
- IPC handlers for call log operations

## Estimated Effort

~60K tokens (medium feature with parsing, storage, UI, and export components)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| iOS version call log format changes | Low | Medium | Test across iOS versions |
| Phone number matching accuracy | Medium | Medium | Implement robust normalization |
| Large call logs affecting performance | Low | Low | Pagination and virtualization |
| Encrypted backup call logs | Medium | High | Ensure backup decryption covers call DB |

## Related Items

- BACKLOG-373: Android Device Support (Android call logs)
- BACKLOG-105: Text Messages Tab (similar UI pattern)
- BACKLOG-332: Audit Package Missing Attachments and Text Messages (export completeness)
- BACKLOG-342: Include Orphan Messages in Audit Export (timeline integration)
