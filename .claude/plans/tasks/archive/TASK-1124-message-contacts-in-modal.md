# TASK-1124: Add Message-Derived Contacts to Select Modal

## Task Overview

| Field | Value |
|-------|-------|
| **Task ID** | TASK-1124 |
| **Backlog Item** | BACKLOG-307 |
| **Sprint** | SPRINT-045 |
| **Priority** | HIGH |
| **Estimated Tokens** | ~35K |
| **Category** | service/ui |

---

## Problem Statement

The Select Contact modal only shows "imported" contacts (from the Contacts app or Outlook). Users who have imported messages show "2206 contacts with unlinked messages" on the dashboard, but see 0 contacts in the Select Contact modal when trying to attach a message sender to a transaction.

**Root Cause:** The `contacts:get-all` and `contacts:get-sorted-by-activity` IPC handlers call `getImportedContactsByUserId()` which only queries the `contacts` table for explicitly imported contacts. Contacts derived from message senders/recipients are not included.

---

## Objective

Modify the contact query to include contacts derived from imported messages alongside explicitly imported contacts. Users should be able to find anyone they've communicated with in the Select Contact modal.

---

## Branch Information

**Branch From:** develop
**Branch Name:** feature/TASK-1124-message-contacts-modal

---

## Files to Modify

| File | Changes |
|------|---------|
| `electron/contact-handlers.ts` | Update `contacts:get-all` (lines 57-105) and `contacts:get-sorted-by-activity` (lines 538-597) to include message-derived contacts |
| `electron/services/databaseService.ts` | Add new method `getMessageDerivedContacts()` or similar |

**Note:** `contactDbService.ts` may not be needed - the query can be added directly to `databaseService.ts`.

---

## Technical Approach

### Option A: Merge at Query Level (Recommended)

Create a new query that UNIONs imported contacts with unique message participants.

**IMPORTANT SCHEMA NOTE:** The `messages` table does NOT have a `sender` or `sender_normalized` column. Instead:
- `participants` - JSON with format `{"from": "email/phone", "to": [...], "cc": [...], "bcc": [...]}`
- `participants_flat` - Denormalized string: "from, to1, to2, cc1" for search

```typescript
// In databaseService.ts
export function getMessageDerivedContacts(userId: string): MessageContact[] {
  // Extract unique participants from messages
  // Note: Need to parse JSON or use participants_flat

  const sql = `
    -- Imported contacts (existing query pattern)
    SELECT
      c.id, c.display_name as name, ce.email, cp.phone_e164 as phone,
      c.company, c.source, c.created_at, NULL as last_communication_at
    FROM contacts c
    LEFT JOIN contact_emails ce ON c.id = ce.contact_id AND ce.is_primary = 1
    LEFT JOIN contact_phones cp ON c.id = cp.contact_id AND cp.is_primary = 1
    WHERE c.user_id = ? AND c.is_deleted = 0 AND c.is_imported = 1

    UNION

    -- Message-derived contacts (extract from participants JSON)
    -- Use json_extract to get the 'from' field
    SELECT
      'msg_' || LOWER(json_extract(participants, '$.from')) as id,
      json_extract(participants, '$.from') as name,
      CASE
        WHEN json_extract(participants, '$.from') LIKE '%@%'
        THEN LOWER(json_extract(participants, '$.from'))
        ELSE NULL
      END as email,
      CASE
        WHEN json_extract(participants, '$.from') NOT LIKE '%@%'
        THEN json_extract(participants, '$.from')
        ELSE NULL
      END as phone,
      NULL as company,
      'messages' as source,
      MIN(sent_at) as created_at,
      MAX(sent_at) as last_communication_at
    FROM messages
    WHERE user_id = ?
      AND participants IS NOT NULL
      AND json_extract(participants, '$.from') IS NOT NULL
      AND json_extract(participants, '$.from') != ''
      -- Exclude if already imported (by email match)
      AND NOT EXISTS (
        SELECT 1 FROM contact_emails ce
        JOIN contacts c ON ce.contact_id = c.id
        WHERE c.user_id = ?
          AND c.is_imported = 1
          AND LOWER(ce.email) = LOWER(json_extract(participants, '$.from'))
      )
    GROUP BY LOWER(json_extract(participants, '$.from'))
  `;
}
```

### Option B: Merge at Handler Level

Keep queries separate and merge results in the handler with deduplication.

### Recommendation

Option A is preferred for performance with large datasets (2000+ contacts). SQL-level deduplication is more efficient than JavaScript.

---

## Acceptance Criteria

- [ ] Select Contact modal shows contacts from imported messages
- [ ] Imported contacts and message-derived contacts are deduplicated (no duplicates)
- [ ] Search works across both types of contacts
- [ ] Performance acceptable with 2000+ contacts (< 2 seconds to load)
- [ ] Contact display shows name correctly for message-derived contacts
- [ ] Existing functionality for imported contacts unchanged

---

## Testing Requirements

### Unit Tests
- [ ] New query returns message participants
- [ ] Deduplication works (same email in both sources = 1 result)
- [ ] Empty messages table still returns imported contacts

### Integration Tests
- [ ] Full modal load with mixed contact sources
- [ ] Contact selection works for message-derived contacts

### Manual Testing
1. Import messages but do NOT import contacts from Contacts app
2. Open transaction > Edit Contacts > Select Contact modal
3. Verify message senders/recipients appear in the list
4. Search for a known message sender by name
5. Select and add to transaction - verify it works

### Performance Testing
- Test with 2000+ unique message participants
- Modal should load in < 2 seconds

---

## Implementation Summary

**Status:** NOT STARTED

### Agent ID

```
Engineer Agent ID: [TO BE RECORDED]
```

### Work Done

[To be filled by engineer]

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | - |
| Duration | - |
| API Calls | - |

**Variance:** PM Est ~35K vs Actual ~XK (X% over/under)

---

## Notes

- The `messages` table uses `participants` (JSON) and `participants_flat` (denormalized string)
- There is NO `sender` or `sender_normalized` column - use `json_extract(participants, '$.from')`
- JSON parsing in SQLite may have performance implications with 2000+ messages
- Consider caching or indexing strategies if performance is an issue
- May need to handle email vs phone number detection in the extracted 'from' field

## SR Engineer Review Notes

**Review Date:** 2026-01-19 | **Status:** APPROVED WITH CORRECTIONS

### Branch Information (SR Engineer decides)
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** feature/TASK-1124-message-contacts-modal

### Execution Classification
- **Parallel Safe:** Yes
- **Depends On:** None
- **Blocks:** TASK-1126 (Phase 2 depends on contacts being findable)

### Technical Considerations
- Original task had schema errors (referenced non-existent `sender` column)
- Corrected to use `json_extract(participants, '$.from')` pattern
- JSON parsing may be slower than simple column access - monitor performance
- **Estimate increased to ~45K** due to JSON parsing complexity
