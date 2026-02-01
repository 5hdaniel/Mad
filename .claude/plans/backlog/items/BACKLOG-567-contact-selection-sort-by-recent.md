# BACKLOG-567: Sort Contacts by Most Recent Communication

## Status
- **Priority**: Medium
- **Status**: Completed
- **Category**: Enhancement
- **Created**: 2026-01-29
- **Completed**: 2026-01-30
- **Related Sprint**: SPRINT-066 (follow-up to TASK-1769)
- **Implemented By**: TASK-1772 (external contact sorting lookup table)

## Problem Statement

Contact selection screens currently display contacts in an undefined order (likely insertion order or alphabetical). Users expect the most relevant contacts - those they've communicated with recently - to appear at the top.

**Affected Components:**
1. `EditContactsModal` (Screen 2 - Add Contacts overlay)
2. `ContactAssignmentStep` in New Audit flow (via `ContactSearchList`)

## Technical Context

The `last_communication_at` field already exists on `ExtendedContact` interface (in `src/types/components.ts`). The field is populated by the database from the most recent message/email timestamp for each contact.

**Current Contact Loading:**
- Contacts are fetched via `contactService.getAllForUser(userId)`
- No sort order is applied in the service or component

## Proposed Solution

Add sorting by `last_communication_at` (descending) when displaying contacts in selection screens. Contacts without communication history should appear after those with recent communication.

### Implementation Approach

**Option A: Service-Level Sort (Recommended)**
Modify `contactDbService.ts` to accept sort parameters:
```typescript
getAllForUser(userId: string, options?: { orderBy?: string, order?: 'asc' | 'desc' })
```

**Option B: Component-Level Sort**
Sort in the component's `useMemo`:
```typescript
const sortedContacts = useMemo(() => {
  return [...contacts].sort((a, b) => {
    const aTime = a.last_communication_at ? new Date(a.last_communication_at).getTime() : 0;
    const bTime = b.last_communication_at ? new Date(b.last_communication_at).getTime() : 0;
    return bTime - aTime; // Most recent first
  });
}, [contacts]);
```

## Files to Modify

| File | Action | Notes |
|------|--------|-------|
| `src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx` | MODIFY | Add sort to availableContacts memo |
| `src/components/shared/ContactSearchList.tsx` | MODIFY | Sort contacts prop before display |
| `src/utils/contactSortUtils.ts` | CREATE (optional) | Shared sort utility if both locations need it |

## Acceptance Criteria

- [ ] EditContactsModal displays contacts sorted by most recent communication first
- [ ] ContactSearchList (used in New Audit flow) displays contacts sorted by most recent communication first
- [ ] Contacts without `last_communication_at` appear after those with recent communication
- [ ] Search filtering still works correctly on sorted list
- [ ] `npm run type-check` passes
- [ ] `npm test` passes

## Verification Steps

1. Create a transaction with contacts from different time periods
2. Open Edit Contacts modal -> Add Contacts
3. Verify contacts with recent messages appear at the top
4. Open New Audit -> step 2 (Contact Assignment)
5. Verify same sort order applies
6. Verify search still works correctly

## Estimated Effort

~8K tokens (small enhancement, single concern)

## Dependencies

None - standalone enhancement.

## Notes

This is a follow-up enhancement from TASK-1769 review. The `last_communication_at` field is already available; this just requires sorting by it.
