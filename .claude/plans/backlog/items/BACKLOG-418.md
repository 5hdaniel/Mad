# BACKLOG-418: Redesign Contact Selection UX (Select First, Assign Roles Second)

**Created**: 2026-01-22
**Status**: Ready
**Priority**: P1 (High)
**Category**: UX Redesign / Performance
**Sprint**: SPRINT-051
**Estimate**: ~40K tokens

---

## Problem

Current Create Transaction flow has poor UX and performance:

1. **Performance**: Each role (buyer, seller, listing_agent, etc.) has its own "Select Contact" button that independently loads contacts → N+1 queries → UI freeze
2. **UX**: User must click through 4-6 separate contact selection modals to assign contacts to roles
3. **Code Duplication**: 3 separate implementations of role assignment components

## Current Flow (Bad)

```
Step 2: Client & Agents
┌─────────────────────────────────────────┐
│ Buyer           [Select Contact] ←── loads contacts
│ Seller          [Select Contact] ←── loads contacts again
│ Listing Agent   [Select Contact] ←── loads contacts again
│ Buying Agent    [Select Contact] ←── loads contacts again
└─────────────────────────────────────────┘

Step 3: Other Parties
┌─────────────────────────────────────────┐
│ Escrow          [Select Contact] ←── loads contacts again
│ Title           [Select Contact] ←── loads contacts again
│ Lender          [Select Contact] ←── loads contacts again
└─────────────────────────────────────────┘
```

**Problems:**
- 6-7 separate contact loads (N+1 queries)
- User clicks through 6-7 modals
- Each modal is a context switch

## Proposed Flow (Good)

```
Step 2: Select Contacts
┌─────────────────────────────────────────┐
│ Search: [_______________]               │
│                                         │
│ ☑ John Smith (john@email.com)          │
│ ☑ Sarah Johnson (+1 424-555-1234)      │
│ ☑ Bob Wilson (bob@company.com)         │
│ ☐ Alice Brown (alice@example.com)      │
│ ☐ ...                                   │
│                                         │
│ Selected: 3 contacts                    │
└─────────────────────────────────────────┘

Step 3: Assign Roles
┌─────────────────────────────────────────┐
│ Drag contacts to roles or use dropdowns │
│                                         │
│ Buyer:         [John Smith ▼]          │
│ Seller:        [Sarah Johnson ▼]       │
│ Listing Agent: [Bob Wilson ▼]          │
│ Buying Agent:  [-- Select --  ▼]       │
│ Escrow:        [-- Select --  ▼]       │
│                                         │
│ Available: John, Sarah, Bob             │
└─────────────────────────────────────────┘
```

**Benefits:**
- **1 contact load** (Step 2 loads once)
- **1 selection UI** (multi-select checklist)
- **Step 3 is pure UI** (dropdowns from already-selected contacts, no API calls)
- **Faster workflow** (2 steps instead of 6-7 modals)

## Implementation

### Step 2: Select Contacts

- Single contact list with search/filter
- Multi-select checkboxes
- Show all contacts (imported, external, manual)
- Load contacts ONCE when entering Step 2
- Store selected contacts in modal state

### Step 3: Assign Roles

- Show only the contacts selected in Step 2
- Dropdown per role (populated from selected contacts)
- No API calls - pure UI state
- Allow same contact for multiple roles (if applicable)
- Visual indication of unassigned contacts

### Shared Component

Create reusable components:

```
src/components/shared/
├── ContactSelector.tsx      # Step 2: Multi-select contact list
├── RoleAssigner.tsx         # Step 3: Role dropdowns from selected contacts
└── ContactRoleFlow.tsx      # Combines both for transaction flows
```

## Files to Modify

| File | Change |
|------|--------|
| `src/components/shared/ContactSelector.tsx` | **NEW** - Multi-select contact list |
| `src/components/shared/RoleAssigner.tsx` | **NEW** - Role assignment from selected |
| `src/components/audit/ContactAssignmentStep.tsx` | Replace with new flow |
| `src/components/audit/RoleAssignment.tsx` | **DELETE** - replaced |
| `src/components/transaction/components/EditTransactionModal.tsx` | Use new shared components |
| `src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx` | Use new shared components |
| `src/hooks/useAuditTransaction.ts` | Update state shape if needed |

## State Shape

```tsx
// In useAuditTransaction or modal state
interface ContactFlowState {
  // Step 2: Selected contacts
  selectedContacts: Contact[];

  // Step 3: Role assignments (contactId per role)
  roleAssignments: {
    buyer?: string;
    seller?: string;
    listing_agent?: string;
    buying_agent?: string;
    escrow?: string;
    title?: string;
    lender?: string;
    // ... other roles
  };
}
```

## Acceptance Criteria

- [ ] Step 2 loads contacts exactly once
- [ ] Step 2 shows multi-select contact list with search
- [ ] Step 3 shows role dropdowns populated from Step 2 selections
- [ ] No API calls in Step 3 (pure UI)
- [ ] No UI freeze in Create Transaction flow
- [ ] Edit Transaction modal uses same flow
- [ ] Edit Contacts modal uses same flow
- [ ] All 3 duplicate components removed
- [ ] TypeScript compiles
- [ ] Existing tests updated/pass

## Migration Notes

- Existing transactions with contacts should still work
- Role assignment data structure in DB unchanged
- Only UI flow changes, not data model

## Related

- BACKLOG-311: EditContactsModal Performance (partial fix, superseded by this)
- BACKLOG-386: Unified Contact Selection UX (related, may consolidate)
- BACKLOG-217: Edit contacts button reuse (will use new shared components)

## Estimated Effort

~40K tokens (UX redesign + component consolidation + 3 integration points)
