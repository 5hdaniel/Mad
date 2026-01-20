# TASK-1128: Filter Nameless Contacts from Select Modal

## Task Overview

| Field | Value |
|-------|-------|
| **Task ID** | TASK-1128 |
| **Backlog Item** | BACKLOG-313 |
| **Sprint** | SPRINT-045 |
| **Priority** | MEDIUM |
| **Estimated Tokens** | ~10K |
| **Category** | bug-fix |

---

## Problem Statement

After TASK-1124 (adding message-derived contacts), the Select Contact modal shows entries where the "name" is just a raw phone number (e.g., "+15551234567") or email address (e.g., "john@example.com") with no actual display name. These clutter the contact list and are not useful for role assignment.

Currently, `getMessageDerivedContacts()` extracts `json_extract(participants, '$.from')` as both `display_name` and `name`. When a message sender has no stored display name, the raw identifier (phone/email) becomes the "name".

---

## Objective

Filter out contacts from the message-derived contacts query where the name is:
- An email address (contains `@`)
- A phone number (starts with `+` or is purely digits)

Only show contacts that have an actual human-readable display name.

---

## Branch Information

**Branch From:** develop
**Branch Name:** fix/TASK-1128-filter-nameless-contacts

---

## Files to Modify

| File | Changes |
|------|---------|
| `electron/services/db/contactDbService.ts` | Add WHERE clause filters to `getMessageDerivedContacts()` |

---

## Technical Approach

### Option A: SQL WHERE Clause (Preferred)

Add filters to the SQL query in `getMessageDerivedContacts()` (around line 65-95):

```sql
-- Add these conditions to the WHERE clause:
AND json_extract(participants, '$.from') NOT LIKE '%@%'
AND json_extract(participants, '$.from') NOT LIKE '+%'
AND json_extract(participants, '$.from') NOT GLOB '[0-9]*'
```

This filters at the database level before the LIMIT 200 is applied, ensuring we get 200 actual contacts with display names rather than 200 raw identifiers.

### Current Query Location

In `contactDbService.ts`, function `getMessageDerivedContacts()`, lines 51-106. The relevant WHERE clause starts at line 87:

```typescript
WHERE user_id = ?
  AND participants IS NOT NULL
  AND json_extract(participants, '$.from') IS NOT NULL
  AND json_extract(participants, '$.from') != ''
  AND json_extract(participants, '$.from') != 'me'
```

### After Modification

```typescript
WHERE user_id = ?
  AND participants IS NOT NULL
  AND json_extract(participants, '$.from') IS NOT NULL
  AND json_extract(participants, '$.from') != ''
  AND json_extract(participants, '$.from') != 'me'
  -- BACKLOG-313: Filter out entries where "name" is raw phone/email
  AND json_extract(participants, '$.from') NOT LIKE '%@%'
  AND json_extract(participants, '$.from') NOT LIKE '+%'
  AND json_extract(participants, '$.from') NOT GLOB '[0-9]*'
```

### Note on Approach

SQL filtering is preferred over JavaScript filtering because:
1. More efficient - filtering happens before LIMIT 200
2. Ensures we get 200 actual named contacts, not 200 raw identifiers
3. Less data transferred from database to application

---

## Acceptance Criteria

- [ ] Contacts with email-pattern names (containing `@`) are NOT shown in selection modal
- [ ] Contacts with phone-pattern names (starting with `+`) are NOT shown
- [ ] Contacts with digit-only names (e.g., "14155551234") are NOT shown
- [ ] Contacts with actual display names continue to appear correctly
- [ ] The LIMIT 200 still applies (performance fix from BACKLOG-311 preserved)
- [ ] `getContactsSortedByActivity()` also benefits (it calls `getMessageDerivedContacts()`)
- [ ] No TypeScript errors
- [ ] Existing tests pass

---

## Testing Requirements

### Manual Testing
1. Open Select Contact modal on a transaction
2. **Verify:** No entries showing raw phone numbers as names
3. **Verify:** No entries showing raw email addresses as names
4. Scroll through list to confirm only human-readable names shown
5. Add a contact to transaction
6. **Verify:** Selection works correctly

### Unit Testing (Optional)
- Add test case to verify filter excludes phone/email pattern names
- Mock messages with both named contacts and raw identifier contacts

---

## Implementation Summary

**Status:** COMPLETE

### Agent ID

```
Engineer Agent ID: f30a2f98 (TASK-1128)
```

### Work Done

Added SQL WHERE clause filters to `getMessageDerivedContacts()` to exclude contacts where the "name" is just a raw phone number or email address:

1. `AND json_extract(participants, '$.from') NOT LIKE '%@%'` - Excludes email addresses
2. `AND json_extract(participants, '$.from') NOT LIKE '+%'` - Excludes phone numbers starting with +
3. `AND json_extract(participants, '$.from') NOT GLOB '[0-9]*'` - Excludes digit-only strings

Updated comment to reflect the new filtering behavior (BACKLOG-313 reference).

### Files Changed

| File | Changes |
|------|---------|
| `electron/services/db/contactDbService.ts` | Added 3 WHERE clause filters + updated comment |

### Quality Gates

- [x] Type-check passes
- [x] Lint passes
- [x] All 155 contact-related tests pass

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | ~5K (est 10K) |
| Duration | - |
| API Calls | - |

**Variance:** PM Est ~10K vs Actual ~5K (under estimate)

---

## Notes

- This task only modifies `contactDbService.ts` - no IPC or frontend changes needed
- The filter applies to message-derived contacts only; imported contacts from the Contacts app are not affected
- This is a straightforward SQL WHERE clause addition (~5-10 lines changed)
- Keep the LIMIT 200 from BACKLOG-311 fix - this filter should come before the LIMIT

## SR Engineer Review Notes

**Review Date:** - | **Status:** PENDING

### Branch Information (SR Engineer decides)
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** fix/TASK-1128-filter-nameless-contacts

### Execution Classification
- **Parallel Safe:** Yes (only touches contactDbService.ts)
- **Depends On:** None
- **Blocks:** None

### Shared File Analysis
- `contactDbService.ts` - Only file modified
- Conflicts with: TASK-1129 (both modify contactDbService.ts)
- **Recommendation:** Execute sequentially with TASK-1129, or merge in series if parallel

### Technical Considerations
- Simple SQL WHERE clause addition
- Estimate is accurate at ~10K
- No TypeScript type changes needed
