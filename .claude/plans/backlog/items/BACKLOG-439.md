# BACKLOG-439: Rename "Sync Communications" to Clarify Functionality

## Summary

The "Sync Communications" button name is misleading. It actually syncs contacts AND fetches new communications based on updated contact info. The name should better reflect what it does.

## Category

UX / Naming

## Priority

P3 - Low (Cosmetic but causes confusion)

## Description

### Problem

The button labeled "Sync Communications" actually does:
1. Syncs/updates contact information from external sources
2. Fetches new emails based on contact email addresses
3. Fetches new texts based on contact phone numbers

Users expect it only syncs communications, not contacts. This causes confusion about workflow.

### Proposed Solutions

**Option A: Rename to broader term**
- "Refresh Data"
- "Sync All"
- "Update & Sync"

**Option B: Split into two buttons**
- "Sync Contacts" - Updates contact info
- "Fetch Communications" - Pulls emails/texts

**Option C: Rename with tooltip**
- Button: "Sync Communications"
- Tooltip: "Updates contacts and fetches new emails & texts"

### Recommendation

Option A with "Sync All" or keep current name but add tooltip explaining full functionality.

## Acceptance Criteria

- [ ] Button name/tooltip clearly indicates it syncs contacts too
- [ ] Users understand clicking will update contact info
- [ ] Consider confirmation if contact sync might overwrite local edits

## Estimated Effort

~3K tokens

## Related Items

- BACKLOG-436: External contact edit + merge conflicts
- BACKLOG-438: Sync all contact emails
