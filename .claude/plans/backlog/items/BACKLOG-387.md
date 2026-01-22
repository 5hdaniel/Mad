# BACKLOG-387: Contact Selection Performance & UX Overhaul in Transaction Creation

**Created**: 2026-01-22
**Priority**: Critical
**Category**: Performance/UX
**Status**: Pending

---

## Problem

When creating a new transaction (Steps 2 & 3), each role's "Select Contact" button triggers a separate API call to `getSortedByActivity`. With ~30 roles, this results in:
- ~30 sequential API calls
- ~1.3 seconds per call
- **~40 seconds total wait time**
- UI loads one role at a time, appearing frozen

### Log Evidence

```
2026-01-22T04:36:38.411Z INFO [Contacts] Getting contacts sorted by activity
2026-01-22T04:36:39.750Z INFO [Contacts] Returning 36 imported contacts
2026-01-22T04:36:39.750Z INFO [Contacts] Getting contacts sorted by activity
2026-01-22T04:36:41.091Z INFO [Contacts] Returning 36 imported contacts
... repeated 30+ times over 40+ seconds
```

### Root Cause

In `RoleAssignment.tsx`:
```typescript
React.useEffect(() => {
  loadContacts();  // Each role instance calls this independently
}, [propertyAddress]);
```

## Solution

### Phase 1: Performance Fix (Quick Win)
Lift contact fetching to parent level:
1. Move `loadContacts()` to `AuditTransactionModal` or `ContactAssignmentStep`
2. Fetch contacts ONCE when entering step 2
3. Pass contacts down as props to all `RoleAssignment` components
4. Expected result: ~1.3 seconds total instead of ~40 seconds

### Phase 2: UX Improvement (User's Suggestion)
Redesign the contact assignment flow:

**Current Flow (Bad):**
```
Step 2: [Client] [+ Select Contact]
        [Buyer Agent] [+ Select Contact]
        [Seller Agent] [+ Select Contact]
        ... 15 more roles with buttons

Step 3: [Lender] [+ Select Contact]
        [Escrow] [+ Select Contact]
        ... 15 more roles with buttons
```

**New Flow (Better):**
```
Step 2: Contact Selection
┌─────────────────────────────────────┐
│ Select contacts for this transaction│
│                                     │
│ ☐ John Smith (john@example.com)    │
│ ☐ Jane Doe (jane@example.com)      │
│ ☐ Bob Lender (bob@lender.com)      │
│ ... more contacts                   │
│                                     │
│ [Continue with 3 selected]          │
└─────────────────────────────────────┘

Step 3: Role Assignment
┌─────────────────────────────────────┐
│ Assign roles to selected contacts   │
│                                     │
│ John Smith    [▼ Client]            │
│ Jane Doe      [▼ Buyer Agent]       │
│ Bob Lender    [▼ Lender]            │
│                                     │
│ [+ Add Another Contact]             │
└─────────────────────────────────────┘
```

**Benefits:**
- Contacts loaded ONCE
- Faster to navigate
- More intuitive "select then assign" pattern
- Matches user mental model

## Acceptance Criteria

### Phase 1 (Critical)
- [ ] Contacts fetched only ONCE per transaction creation
- [ ] All roles share the same contacts data
- [ ] Step 2/3 loads in <2 seconds (not 40+ seconds)
- [ ] No regression in functionality

### Phase 2 (Improvement)
- [ ] Combine steps 2 & 3 into unified flow
- [ ] Select contacts first, then assign roles
- [ ] Role dropdown for each selected contact
- [ ] Ability to add more contacts during assignment
- [ ] Required roles validated before proceeding

## Files Affected

- `src/components/audit/RoleAssignment.tsx` - Remove individual contact fetching
- `src/components/audit/ContactAssignmentStep.tsx` - Receive contacts as props
- `src/components/AuditTransactionModal.tsx` - Lift contact fetching here
- Potentially new components for Phase 2 redesign

## Related

- BACKLOG-228: Similar pattern (UI freeze from repeated API calls)
- BACKLOG-386: Unified Contact Selection UX (SPRINT-050)

## Notes

User reported this during SPRINT-049 testing. This is blocking efficient transaction creation.
