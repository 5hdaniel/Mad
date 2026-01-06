# TASK-994: Multiple Contacts Per Role Save Bug

**Sprint**: SPRINT-027 - Messages & Contacts Polish
**Priority**: 2
**Estimated Tokens**: ~12,000
**Phase**: Phase 1

---

## Problem Statement

When assigning multiple contacts to a specific role on a transaction (using Edit Transaction → Step 2: Assign Client & Agents):
1. Multiple contacts can be selected and appear in the UI
2. After clicking Save, only ONE contact shows
3. Sometimes when re-opening the edit modal, it "sticks" to the first contact assigned

## Expected Behavior

- User can assign multiple contacts to a role (e.g., multiple buyers, multiple agents)
- All assigned contacts should be saved to the database
- All assigned contacts should display after save
- Re-opening edit modal should show all assigned contacts

## Investigation Areas

1. **Save handler**: Check if the save function properly handles arrays of contacts
2. **Database schema**: Verify contacts can be stored as array/multiple entries per role
3. **Form state**: Check if React state management properly tracks multiple selections
4. **Load handler**: Verify edit modal loads all contacts, not just first

## Files to Investigate

- `src/components/transactionDetailsModule/EditTransactionModal.tsx` (or similar)
- Contact assignment step component
- Transaction update service/IPC handler
- Database queries for saving/loading transaction contacts

## Acceptance Criteria

- [ ] Multiple contacts can be assigned to same role
- [ ] All contacts persist after save
- [ ] All contacts display correctly after save
- [ ] Edit modal shows all previously assigned contacts
- [ ] No "sticking" to first contact behavior

---
