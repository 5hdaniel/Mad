# BACKLOG-311: EditContactsModal Performance - Lift Contact Loading

## Type
Performance / Architecture

## Priority
Medium

## Status
Done

**Sprint:** SPRINT-045 (post-sprint fix)
**PRs:** #477 (lift loading to parent), #478 (fix N+1 query)
**Completed:** 2026-01-19

## Summary

The `EditContactsModal` freezes the UI when opened because each `EditRoleAssignment` component independently calls `loadContacts()` in its useEffect, triggering the expensive `getMessageDerivedContacts()` query multiple times (once per role: buyer, seller, listing_agent, etc.).

## Current Behavior

1. User clicks "Edit Contacts" button on transaction Contacts page
2. `EditContactsModal` renders multiple `EditRoleAssignment` components (one per role)
3. EACH `EditRoleAssignment` calls `loadContacts()` in its useEffect
4. Multiple simultaneous `getMessageDerivedContacts()` queries execute
5. UI freezes until all queries complete

**Quick Fix Applied:** Added `LIMIT 200` to `getMessageDerivedContacts()` query (commit a7f3de2 on develop) to reduce individual query impact. This is a band-aid, not a proper fix.

## Expected Behavior

1. `EditContactsModal` parent component loads contacts ONCE on mount
2. Contact data passed down as props to `EditRoleAssignment` components
3. No duplicate queries, no UI freeze

## Root Cause

React anti-pattern: Child components independently fetching shared data instead of parent lifting state up and passing props down.

## Affected Files

| File | Change Required |
|------|-----------------|
| `src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx` | Add contact loading logic, pass contacts as props |
| `EditRoleAssignment` component (inside same file or nearby) | Remove independent `loadContacts()` useEffect, accept contacts as prop |
| `electron/services/db/contactDbService.ts` | No changes (already has LIMIT 200) |

## Implementation Approach

1. **Add state to parent:**
   ```tsx
   // In EditContactsModal
   const [contacts, setContacts] = useState<Contact[]>([]);
   const [isLoadingContacts, setIsLoadingContacts] = useState(true);

   useEffect(() => {
     const loadContactsOnce = async () => {
       setIsLoadingContacts(true);
       const result = await window.api.getMessageDerivedContacts(transactionId);
       setContacts(result);
       setIsLoadingContacts(false);
     };
     loadContactsOnce();
   }, [transactionId]);
   ```

2. **Pass to children:**
   ```tsx
   <EditRoleAssignment
     role="buyer"
     contacts={contacts}
     isLoadingContacts={isLoadingContacts}
     // ... other props
   />
   ```

3. **Update child to receive props:**
   - Remove internal `loadContacts()` useEffect
   - Use `contacts` and `isLoadingContacts` from props

## Acceptance Criteria

- [ ] `EditContactsModal` calls `getMessageDerivedContacts()` exactly once on mount
- [ ] `EditRoleAssignment` components receive contacts as props (no independent queries)
- [ ] No UI freeze when opening Edit Contacts modal
- [ ] Existing functionality preserved (role assignment, contact selection, etc.)
- [ ] No TypeScript errors
- [ ] Existing tests pass

## Technical Notes

- The `LIMIT 200` in `getMessageDerivedContacts()` should remain as a safety net
- Consider adding loading skeleton to `EditRoleAssignment` while contacts load
- This is a textbook React "lift state up" refactor

## Estimated Effort

~15K tokens (straightforward React refactor)

## Related

- Commit a7f3de2 - Quick fix adding LIMIT 200
- Standard React pattern: "Lifting State Up" (https://react.dev/learn/sharing-state-between-components)

## Discovered During

User testing - 2026-01-19
