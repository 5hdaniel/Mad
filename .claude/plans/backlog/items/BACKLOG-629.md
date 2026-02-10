# BACKLOG-629: Import Outlook Contacts to Desktop App

**Status:** backlog
**Priority:** P2 - Must Have
**Category:** feature
**Effort:** ~5-8K tokens
**Created:** 2026-02-07

## Overview

Add Outlook contact import to the Electron desktop app using the existing Microsoft Graph email integration. Contacts should be imported to the existing local SQLite `external_contacts` table with a new "outlook" source type and corresponding UI pill/badge.

## Business Value

- **Unified contact list**: Brokers see all contacts (iPhone, macOS, Outlook) in one place
- **Leverages existing infra**: Microsoft Graph auth already works for emails
- **Low effort**: Reuses existing `external_contacts` table and contact UI

## Requirements

1. **Add `Contacts.Read` scope** to existing Microsoft Graph OAuth flow (if not already present)
2. **Fetch contacts via Graph API** (`/me/contacts`) using existing auth tokens
3. **Import to existing `external_contacts` SQLite table** with source = "outlook"
4. **Add "Outlook" source pill/badge** in the contact list UI (alongside existing "macos"/"iphone" pills)
5. **Dedup logic**: Handle contacts that exist from multiple sources

## Acceptance Criteria

- [ ] Outlook contacts imported to `external_contacts` table
- [ ] New "outlook" source type displayed as pill/badge in UI
- [ ] Existing iPhone/macOS contacts unaffected
- [ ] Uses existing Microsoft Graph auth — no new OAuth flows
- [ ] No duplicate contacts from same Outlook account on re-sync

## Technical Considerations

- All code in root `src/` directory (Electron desktop app), NOT `broker-portal/`
- Reuse existing Microsoft Graph auth/token infrastructure
- Follow existing patterns from email integration and iPhone/macOS contact sync
- SR Engineer should investigate existing codebase before implementation

## References

- Existing email integration in desktop app
- Existing `external_contacts` table and sync logic
- Microsoft Graph Contacts API: `GET /me/contacts`

## Related Items

- Existing contact backlog items (BACKLOG-030 through BACKLOG-050 range — many related to desktop contacts)
