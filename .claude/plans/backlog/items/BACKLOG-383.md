# BACKLOG-383: Format Role Pills with Human-Readable Labels

**Created**: 2026-01-22
**Priority**: Medium
**Category**: UI
**Status**: Pending

---

## Description

The role pills/badges on contact cards in the transaction details Overview page display raw database values like "seller_agent" instead of formatted labels like "Seller Agent".

## Current Behavior

```
┌─────────────────────────────┐
│ John Smith                  │
│ [seller_agent] [primary]    │  ← Looks like code
│ john@example.com            │
└─────────────────────────────┘
```

## Expected Behavior

```
┌─────────────────────────────┐
│ John Smith                  │
│ [Seller Agent] [Primary]    │  ← Professional
│ john@example.com            │
└─────────────────────────────┘
```

## Role Mappings

| Database Value | Display Label |
|----------------|---------------|
| seller_agent | Seller Agent |
| buyer_agent | Buyer Agent |
| seller | Seller |
| buyer | Buyer |
| lender | Lender |
| escrow | Escrow |
| title | Title |
| inspector | Inspector |
| appraiser | Appraiser |
| attorney | Attorney |
| other | Other |

## Acceptance Criteria

- [ ] All role pills display human-readable labels
- [ ] Labels use Title Case formatting
- [ ] Underscores replaced with spaces
- [ ] Consistent styling across all contact cards
- [ ] Works in both Overview and any other places roles are displayed

## Technical Notes

Create a utility function like:
```typescript
function formatRoleLabel(role: string): string {
  return role
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
```

## Related

- TransactionDetailsTab.tsx (Overview section)
- Contact cards component
