# BACKLOG-217: UX Improvement - Edit Contacts Button Flow

**Status:** Pending
**Priority:** HIGH
**Category:** enhancement/ux
**Created:** 2026-01-12

---

## Problem Statement

User wants the "Edit" button for contacts on a transaction to work like the "Attach Message" button - showing the same contact assignment screen used in "Edit Transaction Step 2".

Currently, the edit flow may be confusing or require too many clicks. User expects a more direct, modal-based approach similar to attaching messages.

---

## Current Behavior

When user wants to edit contacts on a transaction:
1. Click "Edit" on transaction
2. Navigate through edit wizard steps
3. Find contacts section
4. Make changes
5. Save

---

## Requested Behavior

When user clicks "Edit" on the contacts section:
1. Open a modal directly showing the contact assignment interface
2. Same UI as "Edit Transaction Step 2" (familiar interface)
3. Make changes and save
4. Modal closes, transaction updates

This mirrors the "Attach Message" button which opens a focused modal for message attachment.

---

## Design Requirements

### Modal Should Include

- Contact role categories (Buyer, Seller, Agents, etc.)
- Contact search/selection
- Add new contact option
- Remove contact option
- Save/Cancel buttons

### UX Principles

| Principle | Implementation |
|-----------|----------------|
| Consistency | Match "Attach Message" button behavior |
| Efficiency | Direct access to contacts without full edit wizard |
| Familiarity | Reuse existing Step 2 contact assignment UI |

---

## Technical Approach

### Option A: Extract Contact Assignment as Standalone Modal

```typescript
// ContactAssignmentModal.tsx
// - Extract from EditTransactionModal Step 2
// - Accept transactionId as prop
// - Handle save/cancel independently
```

### Option B: Add "Quick Edit" Button for Contacts Section

```typescript
// TransactionDetailView.tsx
// Add button that opens EditTransactionModal starting at Step 2
<Button onClick={() => openEditModal({ startStep: 2 })}>
  Edit Contacts
</Button>
```

---

## Acceptance Criteria

- [ ] "Edit Contacts" button on transaction opens contact assignment modal
- [ ] Modal uses same UI as Edit Transaction Step 2
- [ ] Changes save directly to transaction
- [ ] No need to go through full edit wizard
- [ ] Consistent with "Attach Message" button UX
- [ ] Cancel discards changes without affecting transaction

---

## Related Items

| ID | Title | Relationship |
|----|-------|-------------|
| BACKLOG-216 | Contacts not pre-populating | Related bug |
| - | Edit Transaction Modal | Component to refactor |
| - | Attach Message feature | UX reference |

---

## Estimated Effort

**Category:** enhancement/ux
**Estimated Tokens:** ~40K (UI extraction + new button)
**Token Cap:** 160K

---

## Notes

- Need UX confirmation on exact button placement
- May be able to reuse existing contact assignment component
- Consider mobile/responsive layout

---

## Changelog

- 2026-01-12: Created from user testing feedback
