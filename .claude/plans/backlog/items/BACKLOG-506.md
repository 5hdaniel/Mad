# BACKLOG-506: Database Architecture Cleanup - Eliminate Dual-Storage Pattern

## Priority: High

## Category: refactor/architecture

## Status: Pending

## Summary

The SR Engineer architectural review (from BACKLOG-505 investigation) identified that the `communications` table evolved from a content table to a junction table, but still has legacy content columns. This dual-storage pattern was the root cause of the duplicate messages bug.

## Problem

The `communications` table has two patterns:
1. **Legacy (emails)**: Content stored directly in `body_plain`, `subject`, etc.
2. **New (texts)**: Content in `messages` table, `communications` just links via `message_id`

This causes:
- Confusion about where data lives
- Potential for duplicates when both patterns exist for same content
- Complex COALESCE queries to handle both patterns
- Wasted storage (same data in two places)

## SR Engineer Recommendations

### Phase 1: Add Missing Unique Constraints
```sql
-- Prevent duplicate thread links
CREATE UNIQUE INDEX idx_communications_thread_txn_unique
  ON communications(thread_id, transaction_id)
  WHERE thread_id IS NOT NULL AND message_id IS NULL;
```

### Phase 2: Consolidate Contact Junction Tables
- Migrate all `transaction_participants` records to `transaction_contacts`
- Drop `transaction_participants` table
- Single source of truth for contact-transaction relationships

### Phase 3: Remove Legacy Columns from Communications
Drop these columns (since there are no production users):
- `subject`, `body`, `body_plain`
- `sender`, `recipients`, `cc`, `bcc`
- `email_thread_id`, `sent_at`, `received_at`
- `has_attachments`, `attachment_count`, `attachment_metadata`
- `keywords_detected`, `parties_involved`, `communication_category`
- `relevance_score`, `is_compliance_related`, `source`, `communication_type`

### Phase 4: Update All Code
Files that use `body_plain` and need updating:
- `folderExportService.ts`
- `pdfExportService.ts`
- `enhancedExportService.ts`
- `contactDbService.ts`
- `communicationDbService.ts`

## Benefits

1. **Duplicates impossible by design** - not just filtered at runtime
2. **Simpler queries** - no COALESCE fallback logic
3. **Single source of truth** - content only in `messages` table
4. **Better ACID compliance** - clearer referential integrity
5. **Smaller database** - no redundant data storage

## Effort Estimate

- Phase 1: 2-3 turns (add constraints)
- Phase 2: 5-8 turns (consolidate junction tables)
- Phase 3: 8-12 turns (remove columns, update schema)
- Phase 4: 10-15 turns (update all code references)

**Total: ~25-38 turns**

## Dependencies

- BACKLOG-505 must be merged first (provides foundation)

## Related

- BACKLOG-505 (Duplicate Messages Fix - COMPLETED)
- BACKLOG-148 (databaseService migration - related refactor)
