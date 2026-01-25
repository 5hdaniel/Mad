# BACKLOG-488: Transaction & Feature Events

**Category**: service
**Priority**: P1
**Sprint**: SPRINT-059
**Estimated Tokens**: ~10K
**Status**: Pending

---

## Summary

Implement tracking for transaction lifecycle and feature usage events.

## Background

Understanding how users interact with transactions and features drives product decisions.

## Requirements

### Transaction Events

| Event | When | Properties |
|-------|------|------------|
| `transaction_created` | New transaction | `source` (manual/detected), `has_contacts` |
| `transaction_updated` | Edit transaction | `fields_changed[]` |
| `transaction_exported` | Export completes | `format`, `contact_count`, `message_count` |
| `transaction_submitted` | Submit for review | `has_attachments` |
| `transaction_closed` | Mark closed | `days_active` |

### Sync Events

| Event | When | Properties |
|-------|------|------------|
| `sync_started` | Sync begins | `type`, `provider` |
| `sync_completed` | Sync completes | `type`, `items_synced`, `duration_seconds` |
| `sync_failed` | Sync errors | `type`, `error_code` |

### Feature Events

| Event | When | Properties |
|-------|------|------------|
| `ai_detection_used` | AI analyzes | `message_count`, `transactions_detected` |
| `contact_linked` | Contact added | `link_type` (manual/auto) |
| `message_attached` | Message attached | `message_type` (email/text) |

### Implementation

Add tracking calls to relevant services:
- `transactionService.ts`
- `syncService.ts` / sync flows
- `aiDetectionService.ts`
- `contactService.ts`

## Acceptance Criteria

- [ ] Transaction lifecycle events tracked
- [ ] Sync events tracked with duration
- [ ] Feature usage events tracked
- [ ] Properties capture relevant context (no PII)
- [ ] Events appear in PostHog dashboard

## Dependencies

- BACKLOG-486: PostHog SDK must be integrated

## Related Files

- `electron/services/transactionService.ts`
- `electron/services/syncService.ts`
- `electron/services/aiDetectionService.ts`
- `electron/services/contactService.ts`
